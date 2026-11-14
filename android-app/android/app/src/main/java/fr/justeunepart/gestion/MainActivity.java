package fr.justeunepart.gestion;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // À chaque ouverture, charger la dernière version de l'espace de gestion :
        // on vide le cache des fichiers (pas les données ni la connexion).
        WebView webView = getBridge().getWebView();
        webView.clearCache(true);
    }
}
