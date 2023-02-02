package com.nozbe.watermelondb;

import java.util.ArrayList;

public abstract class Connection {
    public static class Connected extends Connection {
        public final DatabaseDriver driver;
        public Connected(DatabaseDriver driver) {
            this.driver = driver;
        }
    }

    public static class Waiting extends Connection {
        public final ArrayList<Runnable> queueInWaiting;
        public Waiting(ArrayList<Runnable> queueInWaiting) {
            this.queueInWaiting = queueInWaiting;
        }
    }

    public ArrayList<Runnable> getQueue() {
        if (this instanceof Connected) {
            return new ArrayList<>();
        } else if (this instanceof Waiting) {
            return ((Waiting) this).queueInWaiting;
        }
        return null;
    }
}