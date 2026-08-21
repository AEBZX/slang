package cn.ae.slang;

import com.intellij.openapi.fileTypes.LanguageFileType;
import com.intellij.openapi.util.IconLoader;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import javax.swing.*;

public class SlangFileType extends LanguageFileType {
    public static final SlangFileType INSTANCE = new SlangFileType();
    private SlangFileType() {
        super(Slang.INSTANCE);
    }

    @Override
    public @NotNull String getName() {
        return "Slang File"; // 内部名称
    }

    @Override
    public @NotNull String getDescription() {
        return "Slang language file";
    }

    @Override
    public @NotNull String getDefaultExtension() {
        return "sl";
    }

    @Override
    public @Nullable Icon getIcon() {
        return SlangIcon.FILE;
    }
}