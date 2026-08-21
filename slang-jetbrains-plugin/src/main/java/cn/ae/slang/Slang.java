package cn.ae.slang;

import com.intellij.lang.Language;
import org.jspecify.annotations.NonNull;

public class Slang extends Language {
    public static final Slang INSTANCE = new Slang();

    private Slang() {
        super("Slang");
    }

    @Override
    public @NonNull String getDisplayName() {
        return "Slang Language";
    }
}
