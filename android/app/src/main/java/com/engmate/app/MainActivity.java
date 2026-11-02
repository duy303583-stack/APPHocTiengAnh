package com.engmate.app;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * App Android của EngMate: hiển thị giao diện web (HTML/CSS/JS) do máy chủ Python phục vụ.
 * Giao diện tự lưu tiến độ trong WebView nên các bài đã tải vẫn học được khi mất mạng.
 */
public class MainActivity extends AppCompatActivity {
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ApiClient api = new ApiClient(BuildConfig.SERVER_URL);
    private WebView webView;
    private View offlineView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);   // localStorage cho tiến độ học
        s.setMediaPlaybackRequiresUserGesture(false);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) showOffline();
            }
        });

        offlineView = buildOfflineView();

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.addView(offlineView, new LinearLayout.LayoutParams(-1, -1));
        root.addView(webView, new LinearLayout.LayoutParams(-1, -1));
        setContentView(root);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack();
                else finish();
            }
        });

        if (savedInstanceState != null) webView.restoreState(savedInstanceState);
        else connect();
    }

    /**
     * Kiểm tra máy chủ ở luồng nền rồi tải trang. Khi máy chủ tắt vẫn thử tải:
     * service worker của trang sẽ trả bản đã lưu nếu app từng mở trước đó.
     */
    private void connect() {
        io.execute(() -> {
            boolean up = api.isServerUp();
            main.post(() -> {
                if (!up) Toast.makeText(this, "Đang offline: dùng bản đã lưu (gia sư AI tạm tắt)", Toast.LENGTH_LONG).show();
                offlineView.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
                webView.loadUrl(BuildConfig.SERVER_URL + "app.html");
            });
        });
    }

    private void showOffline() {
        webView.setVisibility(View.GONE);
        offlineView.setVisibility(View.VISIBLE);
    }

    private View buildOfflineView() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setPadding(64, 64, 64, 64);
        box.setVisibility(View.GONE);

        TextView title = new TextView(this);
        title.setText("🦉\n" + getString(R.string.offline_title));
        title.setTextSize(20);
        title.setGravity(Gravity.CENTER);

        TextView body = new TextView(this);
        body.setText(getString(R.string.offline_body) + "\n\n" + BuildConfig.SERVER_URL);
        body.setGravity(Gravity.CENTER);
        body.setPadding(0, 24, 0, 24);

        Button retry = new Button(this);
        retry.setText(R.string.retry);
        retry.setOnClickListener(v -> connect());

        box.addView(title);
        box.addView(body);
        box.addView(retry);
        return box;
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        io.shutdownNow();
        webView.destroy();
        super.onDestroy();
    }
}
