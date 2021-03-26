/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * <p>This source code is licensed under the MIT license found in the LICENSE file in the root
 * directory of this source tree.
 */
package com.native63;

import android.content.Context;

import com.facebook.flipper.android.AndroidFlipperClient;
import com.facebook.flipper.android.utils.FlipperUtils;
import com.facebook.flipper.core.FlipperClient;
import com.facebook.flipper.plugins.crashreporter.CrashReporterPlugin;
import com.facebook.flipper.plugins.databases.DatabasesFlipperPlugin;
import com.facebook.flipper.plugins.databases.impl.SqliteDatabaseDriver;
import com.facebook.flipper.plugins.databases.impl.SqliteDatabaseProvider;
import com.facebook.flipper.plugins.fresco.FrescoFlipperPlugin;
import com.facebook.flipper.plugins.inspector.DescriptorMapping;
import com.facebook.flipper.plugins.inspector.InspectorFlipperPlugin;
import com.facebook.flipper.plugins.network.FlipperOkhttpInterceptor;
import com.facebook.flipper.plugins.network.NetworkFlipperPlugin;
import com.facebook.flipper.plugins.react.ReactFlipperPlugin;
import com.facebook.flipper.plugins.sharedpreferences.SharedPreferencesFlipperPlugin;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.modules.network.NetworkingModule;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

import okhttp3.OkHttpClient;

public class ReactNativeFlipper {
    public static void initializeFlipper(Context context, ReactInstanceManager reactInstanceManager) {
        if (FlipperUtils.shouldEnableFlipper(context)) {
            final FlipperClient client = AndroidFlipperClient.getInstance(context);

            client.addPlugin(new InspectorFlipperPlugin(context, DescriptorMapping.withDefaults()));
            client.addPlugin(new ReactFlipperPlugin());

            client.addPlugin(new DatabasesFlipperPlugin(new SqliteDatabaseDriver(context, new SqliteDatabaseProvider() {
                @Override
                public List<File> getDatabaseFiles() {
                    List<File> databaseFiles = new ArrayList<>();
                    for (String databaseName : context.databaseList()) {
                        databaseFiles.add(context.getDatabasePath(databaseName));
                    }
                    // https://github.com/Nozbe/WatermelonDB/issues/653#issuecomment-609734515
                    String watermelondb = context.getDatabasePath("WatermelonDemo.db").getPath().replace("/databases", "");
                    databaseFiles.add(new File(watermelondb));
                    return databaseFiles;
                }
            })));

            client.addPlugin(new SharedPreferencesFlipperPlugin(context));
            client.addPlugin(CrashReporterPlugin.getInstance());

            NetworkFlipperPlugin networkFlipperPlugin = new NetworkFlipperPlugin();
            NetworkingModule.setCustomClientBuilder(
                    new NetworkingModule.CustomClientBuilder() {
                        @Override
                        public void apply(OkHttpClient.Builder builder) {
                            builder.addNetworkInterceptor(new FlipperOkhttpInterceptor(networkFlipperPlugin));
                        }
                    });
            client.addPlugin(networkFlipperPlugin);
            client.start();

            // Fresco Plugin needs to ensure that ImagePipelineFactory is initialized
            // Hence we run if after all native modules have been initialized
            ReactContext reactContext = reactInstanceManager.getCurrentReactContext();
            if (reactContext == null) {
                reactInstanceManager.addReactInstanceEventListener(
                        new ReactInstanceManager.ReactInstanceEventListener() {
                            @Override
                            public void onReactContextInitialized(ReactContext reactContext) {
                                reactInstanceManager.removeReactInstanceEventListener(this);
                                reactContext.runOnNativeModulesQueueThread(
                                        new Runnable() {
                                            @Override
                                            public void run() {
                                                client.addPlugin(new FrescoFlipperPlugin());
                                            }
                                        });
                            }
                        });
            } else {
                client.addPlugin(new FrescoFlipperPlugin());
            }
        }
    }
}
