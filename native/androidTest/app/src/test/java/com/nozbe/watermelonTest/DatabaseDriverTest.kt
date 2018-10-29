package com.nozbe.watermelonTest

import android.os.Build.VERSION_CODES.O
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.nozbe.watermelondb.DatabaseDriver
import com.nozbe.watermelondb.Schema
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.powermock.api.mockito.PowerMockito
import org.powermock.core.classloader.annotations.PowerMockIgnore
import org.powermock.core.classloader.annotations.PrepareForTest
import org.powermock.modules.junit4.PowerMockRunner
import org.powermock.modules.junit4.PowerMockRunnerDelegate
import org.powermock.modules.junit4.rule.PowerMockRule
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

private var countAllQuery = "select count(*) as count from test where _status is not 'deleted'"
private var testSchema = """
    create table test (
        id varchar(16) primary key not null,
        created_at datetime not null,
        name varchar(255) not null,
        _status varchar(16)
    );
    """

@RunWith(PowerMockRunner::class)
@PowerMockRunnerDelegate(RobolectricTestRunner::class)
@Config(sdk = [O],
        manifest = Config.NONE)
@PrepareForTest(Arguments::class)
@PowerMockIgnore("org.mockito.*", "org.robolectric.*", "android.*")
class DatabaseDriverTests {
    private lateinit var databaseDriver: DatabaseDriver

    @get:Rule
    var rule = PowerMockRule()

    @Before
    fun setUp() {
        databaseDriver = DatabaseDriver(
                context = RuntimeEnvironment.application.applicationContext,
                dbName = "test",
                schema = Schema(1, testSchema)
        )
        PowerMockito.mockStatic(Arguments::class.java)
        PowerMockito.`when`<WritableArray>(Arguments.createArray()).thenAnswer { JavaOnlyArray() }
        PowerMockito.`when`<WritableMap>(Arguments.createMap()).thenAnswer { JavaOnlyMap() }
    }

    @After
    fun finisher() = databaseDriver.close()

    @Test
    fun testSetUp() =
            assert(databaseDriver.count("select count(*) as count from sqlite_master") > 0)

    @Test
    fun testCountQueryEmpty() {
        assert(databaseDriver.count(countAllQuery) == 0)
        assert(databaseDriver.cachedQuery(countAllQuery) == Arguments.createArray())
    }
}
