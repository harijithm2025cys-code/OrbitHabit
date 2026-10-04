package com.orbithabit.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeAlarmHelperPlugin.class);
        super.onCreate(savedInstanceState);
        AlarmScheduler.createAllNotificationChannels(this);

        if (getIntent() != null && getIntent().hasExtra("habit_id")) {
            NativeAlarmHelperPlugin.lastTappedHabitId = getIntent().getStringExtra("habit_id");
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent != null && intent.hasExtra("habit_id")) {
            NativeAlarmHelperPlugin.lastTappedHabitId = intent.getStringExtra("habit_id");
        }
    }
}

