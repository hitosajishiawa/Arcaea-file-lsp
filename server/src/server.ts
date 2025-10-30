import * as lsp from "vscode-languageserver/node"
import { TextDocument } from 'vscode-languageserver-textdocument'
import { checkAFF } from "./lang"
import { DiagnosticSeverity, TextDocumentSyncKind } from "vscode-languageserver"
import { MultiLangString } from "./multiLang"

let connection = lsp.createConnection()

let documents = new lsp.TextDocuments(TextDocument)

connection.onInitialize((params) => {
	return { capabilities: { textDocumentSync: TextDocumentSyncKind.Full } }
})

connection.onInitialized(() => {
	connection.client.register(lsp.DidChangeConfigurationNotification.type, undefined);
})

connection.onDidChangeConfiguration(change => {
	console.log(`change config`)
	let allDoc = documents.all();
	allDoc.forEach(validateTextDocument);
	allDoc.forEach(refreshDiagnoseLanguage);
})

documents.onDidChangeContent((change) => {
	console.log(`change ${change.document.uri}`)
	validateTextDocument(change.document)
})

documents.onDidClose((change) => {
	console.log(`close ${change.document.uri}`)
	connection.sendDiagnostics({
		uri: change.document.uri, diagnostics: []
	})
})

const getSetting = async (uri: string) => await connection.workspace.getConfiguration({ scopeUri: uri, section: "arcaeaFileFormat" })

const validateTextDocument = async (textDocument: TextDocument) => {
	const level = (await getSetting(textDocument.uri)).diagnosticLevel
	const errors = checkAFF(textDocument).filter((e) => {
		if (level == "warn") {
			return e.severity != DiagnosticSeverity.Information
		} else if (level == "error") {
			return e.severity != DiagnosticSeverity.Information && e.severity != DiagnosticSeverity.Warning
		}
		return true
	})
	connection.sendDiagnostics({
		uri: textDocument.uri, diagnostics: errors
	})
}

export var diagnoseLanguage: keyof MultiLangString = 'en';

const refreshDiagnoseLanguage = async (textDocument: TextDocument) => {
	diagnoseLanguage = (await getSetting(textDocument.uri)).diagnoseLanguage;
}

documents.listen(connection)

connection.listen()