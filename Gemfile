source 'https://rubygems.org'

ruby ">= 2.6.10"

gem 'pry'

# Cocoapods 1.15 introduced a bug which break the build. (RN 0.72) We will remove the upper
# bound in the template on Cocoapods with next React Native release.
gem 'cocoapods', '>= 1.13', '< 1.15'
gem 'activesupport', '>= 6.1.7.5', '< 7.1.0' # temporary?
gem 'xcodeproj', '< 1.26.0'

# NOTE: TEMPORARY, for darwin-arm64 compatibility
gem 'ffi', '>1.14.2'
gem 'ethon', git: 'https://github.com/radex/ethon.git', ref: '301517d087830569985eb3945fa5a6c74866863f'
