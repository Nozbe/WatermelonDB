/*
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#pragma once
#define FOLLY_ARENA_H_

#include <cassert>
#include <limits>
#include <stdexcept>
#include <utility>

#include <boost/intrusive/slist.hpp>

#include <folly/Conv.h>
#include <folly/Likely.h>
#include <folly/Memory.h>
#include <folly/lang/Align.h>
#include <folly/lang/CheckedMath.h>
#include <folly/lang/Exception.h>
#include <folly/memory/Malloc.h>

namespace folly {

/**
 * Simple arena: allocate memory which gets freed when the arena gets
 * destroyed.
 *
 * The arena itself allocates memory using a custom allocator which conforms
 * to the C++ concept Allocator.
 *
 *   http://en.cppreference.com/w/cpp/concept/Allocator
 *
 * You may also specialize ArenaAllocatorTraits for your allocator type to
 * provide:
 *
 *   size_t goodSize(const Allocator& alloc, size_t size) const;
 *      Return a size (>= the provided size) that is considered "good" for your
 *      allocator (for example, if your allocator allocates memory in 4MB
 *      chunks, size should be rounded up to 4MB).  The provided value is
 *      guaranteed to be rounded up to a multiple of the maximum alignment
 *      required on your system; the returned value must be also.
 *
 * An implementation that uses malloc() / free() is defined below, see SysArena.
 */
template <class Alloc>
struct ArenaAllocatorTraits;
template <class Alloc>
class Arena {
 public:
  explicit Arena(
      const Alloc& alloc,
      size_t minBlockSize = kDefaultMinBlockSize,
      size_t sizeLimit = kNoSizeLimit,
      size_t maxAlign = kDefaultMaxAlign)
      : allocAndSize_(alloc, minBlockSize),
        ptr_(nullptr),
        end_(nullptr),
        totalAllocatedSize_(0),
        bytesUsed_(0),
        sizeLimit_(sizeLimit),
        maxAlign_(maxAlign) {
    if ((maxAlign_ & (maxAlign_ - 1)) || maxAlign_ > alignof(Block)) {
      throw_exception(std::invalid_argument(
          folly::to<std::string>("Invalid maxAlign: ", maxAlign_)));
    }
  }

  ~Arena();

  void* allocate(size_t size) {
    size = roundUp(size);
    bytesUsed_ += size;

    assert(ptr_ <= end_);
    if (LIKELY((size_t)(end_ - ptr_) >= size)) {
      // Fast path: there's enough room in the current block
      char* r = ptr_;
      ptr_ += size;
      assert(isAligned(r));
      return r;
    }

    // Not enough room in the current block
    void* r = allocateSlow(size);
    assert(isAligned(r));
    return r;
  }

  void deallocate(void* /* p */, size_t = 0) {
    // Deallocate? Never!
  }

  // Transfer ownership of all memory allocated from "other" to "this".
  void merge(Arena&& other);

  // Gets the total memory used by the arena
  size_t totalSize() const {
    return totalAllocatedSize_ + sizeof(Arena);
  }

  // Gets the total number of "used" bytes, i.e. bytes that the arena users
  // allocated via the calls to `allocate`. Doesn't include fragmentation, e.g.
  // if block size is 4KB and you allocate 2 objects of 3KB in size,
  // `bytesUsed()` will be 6KB, while `totalSize()` will be 8KB+.
  size_t bytesUsed() const {
    return bytesUsed_;
  }

  // not copyable or movable
  Arena(const Arena&) = delete;
  Arena& operator=(const Arena&) = delete;
  Arena(Arena&&) = delete;
  Arena& operator=(Arena&&) = delete;

 private:
  struct Block;
  typedef boost::intrusive::slist_member_hook<boost::intrusive::tag<Arena>>
      BlockLink;

  struct alignas(max_align_v) Block {
    BlockLink link;

    // Allocate a block with at least size bytes of storage.
    // If allowSlack is true, allocate more than size bytes if convenient
    // (via ArenaAllocatorTraits::goodSize()) as we'll try to pack small
    // allocations in this block.
    static std::pair<Block*, size_t>
    allocate(Alloc& alloc, size_t size, bool allowSlack);
    void deallocate(Alloc& alloc);

    char* start() {
      return reinterpret_cast<char*>(this + 1);
    }

   private:
    Block() = default;
    ~Block() = default;
  };

 public:
  static constexpr size_t kDefaultMinBlockSize = 4096 - sizeof(Block);
  static constexpr size_t kNoSizeLimit = 0;
  static constexpr size_t kDefaultMaxAlign = alignof(Block);
  static constexpr size_t kBlockOverhead = sizeof(Block);

 private:
  bool isAligned(uintptr_t address) const {
    return (address & (maxAlign_ - 1)) == 0;
  }
  bool isAligned(void* p) const {
    return isAligned(reinterpret_cast<uintptr_t>(p));
  }

  // Round up size so it's properly aligned
  size_t roundUp(size_t size) const {
    auto maxAl = maxAlign_ - 1;
    size_t realSize;
    if (!checked_add<size_t>(&realSize, size, maxAl)) {
      throw_exception<std::bad_alloc>();
    }
    return realSize & ~maxAl;
  }

  // cache_last<true> makes the list keep a pointer to the last element, so we
  // have push_back() and constant time splice_after()
  typedef boost::intrusive::slist<
      Block,
      boost::intrusive::member_hook<Block, BlockLink, &Block::link>,
      boost::intrusive::constant_time_size<false>,
      boost::intrusive::cache_last<true>>
      BlockList;

  void* allocateSlow(size_t size);

  // Empty member optimization: package Alloc with a non-empty member
  // in case Alloc is empty (as it is in the case of SysAllocator).
  struct AllocAndSize : public Alloc {
    explicit AllocAndSize(const Alloc& a, size_t s)
        : Alloc(a), minBlockSize(s) {}

    size_t minBlockSize;
  };

  size_t minBlockSize() const {
    return allocAndSize_.minBlockSize;
  }
  Alloc& alloc() {
    return allocAndSize_;
  }
  const Alloc& alloc() const {
    return allocAndSize_;
  }

  AllocAndSize allocAndSize_;
  BlockList blocks_;
  char* ptr_;
  char* end_;
  size_t totalAllocatedSize_;
  size_t bytesUsed_;
  const size_t sizeLimit_;
  const size_t maxAlign_;
};

template <class Alloc>
struct AllocatorHasTrivialDeallocate<Arena<Alloc>> : std::true_type {};

/**
 * By default, don't pad the given size.
 */
template <class Alloc>
struct ArenaAllocatorTraits {
  static size_t goodSize(const Alloc& /* alloc */, size_t size) {
    return size;
  }
};

template <>
struct ArenaAllocatorTraits<SysAllocator<void>> {
  static size_t goodSize(const SysAllocator<void>& /* alloc */, size_t size) {
    return goodMallocSize(size);
  }
};

/**
 * Arena that uses the system allocator (malloc / free)
 */
class SysArena : public Arena<SysAllocator<void>> {
 public:
  explicit SysArena(
      size_t minBlockSize = kDefaultMinBlockSize,
      size_t sizeLimit = kNoSizeLimit,
      size_t maxAlign = kDefaultMaxAlign)
      : Arena<SysAllocator<void>>({}, minBlockSize, sizeLimit, maxAlign) {}
};

template <>
struct AllocatorHasTrivialDeallocate<SysArena> : std::true_type {};

template <typename T, typename Alloc>
using ArenaAllocator = CxxAllocatorAdaptor<T, Arena<Alloc>>;

template <typename T>
using SysArenaAllocator = ArenaAllocator<T, SysAllocator<void>>;

} // namespace folly

#include <folly/memory/Arena-inl.h>
