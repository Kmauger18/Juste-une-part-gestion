package fr.justeunepart.gestion;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import java.net.URLEncoder;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends BridgeActivity {
    private static final String ADRESSE = "https://kmauger18.github.io/Juste-une-part-gestion/";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // À chaque ouverture, charger la dernière version de l'espace de gestion :
        // on vide le cache des fichiers (pas les données ni la connexion).
        WebView webView = getBridge().getWebView();
        webView.clearCache(true);
        ouvrirLienPartage(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        ouvrirLienPartage(intent);
    }

    // Lien de recette reçu par « Partager » : on l'ouvre dans l'import de recettes
    private void ouvrirLienPartage(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String texte = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (texte == null) return;
        Matcher m = Pattern.compile("https?://\\S+").matcher(texte);
        if (!m.find()) return;
        try {
            final String url = ADRESSE + "#importer=" + URLEncoder.encode(m.group(), "UTF-8");
            final WebView webView = getBridge().getWebView();
            webView.postDelayed(() -> webView.loadUrl(url), 300);
        } catch (Exception e) { /* lien illisible : on ouvre l'appli normalement */ }
        intent.setAction(Intent.ACTION_MAIN);
    }
}
