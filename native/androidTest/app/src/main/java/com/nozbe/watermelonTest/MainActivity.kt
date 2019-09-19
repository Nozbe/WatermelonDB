package com.nozbe.watermelonTest

import android.os.Bundle
import androidx.appcompat.app.AlertDialog
import com.facebook.react.ReactActivity
import com.example.hellojni.HelloJni
import com.facebook.react.bridge.ReactContext
import com.facebook.react.ReactInstanceManager



class MainActivity : ReactActivity(), ReactInstanceManager.ReactInstanceEventListener {
    override fun getMainComponentName(): String? = "watermelonTest"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val hello = HelloJni()

        AlertDialog.Builder(this)
                .setTitle("I got a message from JNI for ya!")
                .setMessage(hello.stringFromJNI() + "; " + hello.stringFromJNICpp())

                // Specifying a listener allows you to take an action before dismissing the dialog.
                // The dialog is automatically dismissed when a dialog button is clicked.
                .setPositiveButton(android.R.string.yes,null)

                // A null listener allows the button to dismiss the dialog and take no further action.
                .setNegativeButton(android.R.string.no, null)
                .setIcon(android.R.drawable.ic_dialog_alert)
                .show()
    }

    public override fun onResume() {
        super.onResume()
        reactInstanceManager.addReactInstanceEventListener(this)
    }

    public override fun onPause() {
        super.onPause()
        reactInstanceManager.removeReactInstanceEventListener(this)
    }

    override fun onReactContextInitialized(context: ReactContext) {
        HelloJni().installBinding(context.javaScriptContextHolder.get())
    }
}
