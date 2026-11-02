package com.engmate.app;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Gọi API của máy chủ Python (server/app.py). Mọi hàm đều chặn luồng: hãy gọi từ luồng nền.
 */
public final class ApiClient {
    private final String baseUrl;

    public ApiClient(String baseUrl) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
    }

    /** GET /api/health → true nếu máy chủ đang chạy. */
    public boolean isServerUp() {
        try {
            HttpURLConnection conn = open("api/health", "GET");
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);
            int code = conn.getResponseCode();
            conn.disconnect();
            return code == 200;
        } catch (IOException e) {
            return false;
        }
    }

    /** GET /api/stats/{userId} → { name, level, xp, streak, lessonsCompleted, badges }. */
    public JSONObject getStats(String userId) throws IOException, JSONException {
        HttpURLConnection conn = open("api/stats/" + userId, "GET");
        try {
            return new JSONObject(readAll(checked(conn)));
        } finally {
            conn.disconnect();
        }
    }

    /** Nhận từng đoạn chữ khi gia sư AI đang trả lời. */
    public interface ChatListener {
        void onText(String delta);
    }

    /**
     * POST /api/chat. history là mảng [{role, content}, ...] kết thúc bằng tin nhắn của người dùng.
     * Trả về sự kiện cuối { done, stop_reason, content } để nối tiếp vào history.
     */
    public JSONObject chat(JSONArray history, String level, String ageGroup, String scenario, String name,
                           ChatListener listener) throws IOException, JSONException {
        JSONObject body = new JSONObject()
                .put("history", history)
                .put("level", level)
                .put("ageGroup", ageGroup)
                .put("scenario", scenario)
                .put("name", name);
        HttpURLConnection conn = open("api/chat", "POST");
        conn.setDoOutput(true);
        conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        conn.setReadTimeout(120_000);
        try (OutputStream out = conn.getOutputStream()) {
            out.write(body.toString().getBytes(StandardCharsets.UTF_8));
        }
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(checked(conn), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.startsWith("data: ")) continue;
                JSONObject event = new JSONObject(line.substring(6));
                if (event.has("error")) throw new IOException(event.getString("error"));
                if (event.has("text")) listener.onText(event.getString("text"));
                if (event.optBoolean("done")) return event;
            }
        } finally {
            conn.disconnect();
        }
        throw new IOException("Mất kết nối với máy chủ giữa chừng.");
    }

    private HttpURLConnection open(String path, String method) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(baseUrl + path).openConnection();
        conn.setRequestMethod(method);
        conn.setConnectTimeout(10_000);
        return conn;
    }

    private static InputStream checked(HttpURLConnection conn) throws IOException {
        int code = conn.getResponseCode();
        if (code >= 400) {
            InputStream err = conn.getErrorStream();
            String msg = err != null ? readAll(err) : "";
            throw new IOException("HTTP " + code + " " + msg);
        }
        return conn.getInputStream();
    }

    private static String readAll(InputStream in) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            String line;
            while ((line = r.readLine()) != null) sb.append(line).append('\n');
        }
        return sb.toString();
    }
}
