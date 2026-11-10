package com.nozbe.watermelonTest;

import android.content.Context;
import androidx.test.platform.app.InstrumentationRegistry;
import com.nozbe.watermelondb.WMDatabaseDriver;
import com.nozbe.watermelondb.utils.Schema;
import java.io.File;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.UUID;
import java.util.logging.Logger;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import static org.junit.Assert.assertEquals;

public class WMDatabaseDriverTest {
    private WMDatabaseDriver driver;
    private String databasePath;

    @Before
    public void setUp() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        String databaseName = new File(context.getCacheDir(), "watermelon-driver-" + UUID.randomUUID()).getAbsolutePath();
        databasePath = databaseName + ".db";
        driver = new WMDatabaseDriver(context, databaseName, new Schema(2,
                "create table tasks (id text primary key); insert into tasks (id) values ('task');"), false);
    }

    @After
    public void tearDown() {
        if (driver != null) {
            driver.close();
        }
        if (databasePath != null) {
            new File(databasePath).delete();
            new File(databasePath + "-wal").delete();
            new File(databasePath + "-shm").delete();
        }
    }

    @Test
    public void newerDatabaseWithNullLoggerNeedsSetup() throws Throwable {
        // The native test app is debug-only. Reproduce the Release constructor's null logger.
        assertCompatibility(null, 1, "NeedsSetup");
        assertEquals(1, driver.count("select count(*) as count from tasks", new Object[]{}));
    }

    @Test
    public void newerDatabaseWithLoggerNeedsSetup() throws Throwable {
        assertCompatibility(Logger.getLogger("WMDatabaseDriverTest"), 1, "NeedsSetup");
    }

    @Test
    public void matchingDatabaseWithNullLoggerIsCompatible() throws Throwable {
        assertCompatibility(null, 2, "Compatible");
    }

    @Test
    public void olderDatabaseWithNullLoggerNeedsMigration() throws Throwable {
        assertCompatibility(null, 3, "NeedsMigration");
    }

    private void assertCompatibility(Logger logger, int schemaVersion, String expected) throws Throwable {
        Field log = WMDatabaseDriver.class.getDeclaredField("log");
        log.setAccessible(true);
        log.set(driver, logger);
        Method isCompatible = WMDatabaseDriver.class.getDeclaredMethod("isCompatible", int.class);
        isCompatible.setAccessible(true);
        try {
            assertEquals(expected, isCompatible.invoke(driver, schemaVersion).getClass().getSimpleName());
        } catch (InvocationTargetException error) {
            throw error.getCause();
        }
    }
}
