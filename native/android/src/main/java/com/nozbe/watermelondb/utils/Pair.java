package com.nozbe.watermelondb.utils;

public class Pair<K,V> {
    public K first;
    public V second;

    private Pair(K key, V value) {
        first = key;
        second = value;
    }

    public static <K,V> Pair<K,V> create(K key, V value) {
        return new Pair<>(key, value);
    }
}
