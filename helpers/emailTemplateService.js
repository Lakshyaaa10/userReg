const fs = require("fs");
const path = require("path");
const pug = require("pug");

const templatesDir = path.join(__dirname, "..", "templates", "emails");
const cache = new Map();

function getTemplateRenderer(templateName) {
  const filePath = path.join(templatesDir, templateName);
  if (!cache.has(filePath)) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Email template missing: ${templateName}`);
    }
    cache.set(filePath, pug.compileFile(filePath));
  }
  return cache.get(filePath);
}

function renderTemplate(templateName, locals) {
  const render = getTemplateRenderer(templateName);
  return render({
    brandName: process.env.EMAIL_BRAND_NAME || "Zugo",
    supportEmail: process.env.SUPPORT_EMAIL || process.env.SMTP_USER || "support@zugo.co.in",
    websiteUrl: process.env.FRONTEND_URL || "https://zugo.co.in",
    ...locals,
  });
}

module.exports = {
  renderTemplate,
};
