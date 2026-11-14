package fr.justeunepart.gestion;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Toujours charger la dernière version de l'espace de gestion :
        // on vide le cache des fichiers (pas les données ni la connexion).
        WebView webView = getBridge().getWebView();
        webView.clearCache(true);
        webView.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
    }
}
