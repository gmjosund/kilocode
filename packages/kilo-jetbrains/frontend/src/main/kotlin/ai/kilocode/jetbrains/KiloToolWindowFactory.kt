package ai.kilocode.jetbrains

import com.intellij.openapi.project.Project
import com.intellij.openapi.util.IconLoader
import com.intellij.openapi.util.text.HtmlChunk
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.components.JBLabel
import com.intellij.ui.content.ContentFactory
import com.intellij.util.ui.JBUI
import com.intellij.util.ui.UIUtil
import java.awt.GridBagConstraints
import java.awt.GridBagLayout
import javax.swing.Box
import javax.swing.BoxLayout
import javax.swing.JPanel
import javax.swing.SwingConstants

class KiloToolWindowFactory : ToolWindowFactory {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val icon = JBLabel(
            IconLoader.getIcon("/icons/kilo-content.svg", KiloToolWindowFactory::class.java),
        ).apply {
            horizontalAlignment = SwingConstants.CENTER
            alignmentX = JPanel.CENTER_ALIGNMENT
        }

        val msg = HtmlChunk.div()
            .style("text-align:center; width:${JBUI.scale(260)}px")
            .addText("Kilo Code is an AI coding assistant. Ask it to build features, fix bugs, or explain your codebase.")
        val text = JBLabel(HtmlChunk.html().child(msg).toString(), SwingConstants.CENTER).apply {
            alignmentX = JPanel.CENTER_ALIGNMENT
            font = JBUI.Fonts.label(13f)
            foreground = UIUtil.getContextHelpForeground()
        }

        val body = JPanel().apply {
            layout = BoxLayout(this, BoxLayout.Y_AXIS)
            isOpaque = false
            add(icon)
            add(Box.createVerticalStrut(JBUI.scale(16)))
            add(text)
        }

        val panel = JPanel(GridBagLayout()).apply {
            isOpaque = false
            add(body, GridBagConstraints())
        }

        val content = ContentFactory.getInstance().createContent(panel, "", false)
        toolWindow.contentManager.addContent(content)
    }
}
