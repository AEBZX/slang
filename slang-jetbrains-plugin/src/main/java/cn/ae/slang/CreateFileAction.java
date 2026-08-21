package cn.ae.slang;

import com.intellij.ide.actions.CreateFileFromTemplateAction;
import com.intellij.ide.actions.CreateFileFromTemplateDialog;
import com.intellij.openapi.project.Project;
import com.intellij.psi.PsiDirectory;
import org.jetbrains.annotations.NotNull;

public class CreateFileAction extends CreateFileFromTemplateAction {
    public CreateFileAction() {
        // 设置菜单中显示的名称和描述
        super("Slang File", "创建一个新的 slang 文件", SlangIcon.FILE);
    }

    @Override
    protected void buildDialog(@NotNull Project project, @NotNull PsiDirectory directory, CreateFileFromTemplateDialog.@NotNull Builder builder) {
        // 设置对话框标题，并添加一个“种类”（Kind）
        // “Slang”是显示在对话框中的名称，“My Slang File”对应第一步中模板的文件名（不带.ft后缀）
        builder.setTitle("新建 Slang 文件")
                .addKind("Slang 文件", SlangIcon.FILE, "SlangSourceFile");
    }

    @Override
    protected String getActionName(PsiDirectory directory, @NotNull String newName, String templateName) {
        // 这个方法用于在创建日志或错误消息中显示操作名称
        return "新建 Slang 文件: " + newName;
    }
}
