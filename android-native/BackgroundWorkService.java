package com.quizpro.reelsstudio1;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

public class BackgroundWorkService extends Service {
    public static final String ACTION_START_OR_UPDATE = "com.quizpro.reelsstudio1.action.START_OR_UPDATE";
    public static final String ACTION_STOP = "com.quizpro.reelsstudio1.action.STOP";
    public static final String EXTRA_LABEL = "extra_label";
    public static final String EXTRA_PROGRESS = "extra_progress";

    private static final String CHANNEL_BG_ID = "quizpro_background_work";
    private static final String CHANNEL_DONE_ID = "quizpro_background_done";
    private static final int NOTIFICATION_BG_ID = 4101;
    private static final int NOTIFICATION_DONE_ID = 4102;

    private PowerManager.WakeLock cpuWakeLock;
    private WifiManager.WifiLock wifiLock;

    @Override
    public void onCreate() {
        super.onCreate();
        ensureChannels();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            releaseLocks();
            stopForegroundCompat();
            stopSelf();
            return START_NOT_STICKY;
        }

        String label = intent != null ? intent.getStringExtra(EXTRA_LABEL) : null;
        if (label == null || label.trim().isEmpty()) {
            label = "جارٍ المتابعة في الخلفية...";
        }
        int progress = intent != null ? intent.getIntExtra(EXTRA_PROGRESS, -1) : -1;

        acquireLocks();
        Notification notification = buildProgressNotification(label, progress);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                    NOTIFICATION_BG_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            );
        } else {
            startForeground(NOTIFICATION_BG_ID, notification);
        }

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        releaseLocks();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
    }

    private void ensureChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        if (nm.getNotificationChannel(CHANNEL_BG_ID) == null) {
            NotificationChannel bgChannel = new NotificationChannel(
                    CHANNEL_BG_ID,
                    "العمل في الخلفية",
                    NotificationManager.IMPORTANCE_LOW
            );
            bgChannel.setDescription("إبقاء توليد السلاسل وتصدير الفيديو مستمراً عند قفل الشاشة أو مغادرة التطبيق");
            bgChannel.setShowBadge(false);
            nm.createNotificationChannel(bgChannel);
        }

        if (nm.getNotificationChannel(CHANNEL_DONE_ID) == null) {
            NotificationChannel doneChannel = new NotificationChannel(
                    CHANNEL_DONE_ID,
                    "اكتمال المهام",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            doneChannel.setDescription("تنبيه عند انتهاء التوليد أو التصدير في الخلفية");
            nm.createNotificationChannel(doneChannel);
        }
    }

    private PendingIntent createAppPendingIntent() {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(this, 0, openIntent, flags);
    }

    private Notification buildProgressNotification(String label, int progressPct) {
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_BG_ID)
                .setContentTitle("استوديو كويز برو")
                .setContentText(label)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(createAppPendingIntent());

        if (progressPct >= 0 && progressPct <= 100) {
            builder.setProgress(100, progressPct, false);
        } else {
            builder.setProgress(0, 0, true);
        }

        return builder.build();
    }

    private void acquireLocks() {
        try {
            if (cpuWakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    cpuWakeLock = pm.newWakeLock(
                            PowerManager.PARTIAL_WAKE_LOCK,
                            "QuizPro:BackgroundWorkWakeLock"
                    );
                    cpuWakeLock.setReferenceCounted(false);
                }
            }
            if (cpuWakeLock != null && !cpuWakeLock.isHeld()) {
                // Max safety timeout: 60 minutes per continuous session
                cpuWakeLock.acquire(60L * 60L * 1000L);
            }
        } catch (Exception ignored) {
            // ignore
        }

        try {
            if (wifiLock == null) {
                WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wm != null) {
                    int mode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                            ? WifiManager.WIFI_MODE_FULL_LOW_LATENCY
                            : WifiManager.WIFI_MODE_FULL_HIGH_PERF;
                    wifiLock = wm.createWifiLock(mode, "QuizPro:BackgroundWifiLock");
                    wifiLock.setReferenceCounted(false);
                }
            }
            if (wifiLock != null && !wifiLock.isHeld()) {
                wifiLock.acquire();
            }
        } catch (Exception ignored) {
            // ignore
        }
    }

    private void releaseLocks() {
        try {
            if (cpuWakeLock != null && cpuWakeLock.isHeld()) {
                cpuWakeLock.release();
            }
        } catch (Exception ignored) {
            // ignore
        }
        try {
            if (wifiLock != null && wifiLock.isHeld()) {
                wifiLock.release();
            }
        } catch (Exception ignored) {
            // ignore
        }
    }

    public static void postCompletionNotification(Context context, String title, String body) {
        if (context == null || title == null || title.trim().isEmpty()) return;
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(CHANNEL_DONE_ID) == null) {
                NotificationChannel doneChannel = new NotificationChannel(
                        CHANNEL_DONE_ID,
                        "اكتمال المهام",
                        NotificationManager.IMPORTANCE_DEFAULT
                );
                nm.createNotificationChannel(doneChannel);
            }

            Intent openIntent = new Intent(context, MainActivity.class);
            openIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pi = PendingIntent.getActivity(context, 1, openIntent, flags);

            Notification doneNotification = new NotificationCompat.Builder(context, CHANNEL_DONE_ID)
                    .setContentTitle(title)
                    .setContentText(body != null ? body : "")
                    .setSmallIcon(android.R.drawable.stat_sys_download_done)
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                    .setContentIntent(pi)
                    .build();

            nm.notify(NOTIFICATION_DONE_ID, doneNotification);
        } catch (Exception ignored) {
            // ignore
        }
    }
}
