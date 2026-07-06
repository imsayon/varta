import Handlebars from "handlebars"
import DOMPurify from "isomorphic-dompurify"

export const templateRendererService = {
	compile(templateString: string): HandlebarsTemplateDelegate {
		return Handlebars.compile(templateString || "", { strict: true })
	},

	render(
		compiledTemplate: HandlebarsTemplateDelegate,
		payload: Record<string, unknown>,
	): string {
		return compiledTemplate(payload)
	},

	sanitize(html: string): string {
		return DOMPurify.sanitize(html)
	},

	renderAndSanitize(
		templateString: string,
		payload: Record<string, unknown>,
	): string {
		const compiled = this.compile(templateString)
		const rendered = this.render(compiled, payload)
		return this.sanitize(rendered)
	},
}
