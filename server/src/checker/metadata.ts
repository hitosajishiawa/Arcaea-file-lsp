import { DiagnosticSeverity } from "vscode-languageserver"
import { AFFChecker } from "../types"

export const metadataChecker: AFFChecker = (file, errors) => {
	for (const entry of file.metadata.data.data.values()) {
		if (!["AudioOffset", "TimingPointDensityFactor"].includes(entry.data.key.data)) {
			errors.push({
				message: {
					en: `The "${entry.data.key.data}" metadata is not used and will be ignored`,
					zh: `非标准的元数据 "${entry.data.key.data}" 将被忽略`
				},
				severity: DiagnosticSeverity.Warning,
				location: entry.data.key.location,
			})
		}
	}
	if (!file.metadata.data.data.has("AudioOffset")) {
		errors.push({
			message: {
				en: `The "AudioOffset" metadata is missing, this chart will be processed with zero audio offset`,
				zh: `缺失 AudioOffset 元数据，值被视为 0`
			},
			severity: DiagnosticSeverity.Warning,
			location: file.metadata.data.metaEndLocation,
		})
	} else {
		const offset = file.metadata.data.data.get("AudioOffset")
		if (!offset.data.value.data.match(/^-?(?:0|[1-9][0-9]*)$/)) {
			errors.push({
				message: {
					en: `The value of "AudioOffset" metadata is not an int`,
					zh: `AudioOffset 值类型应为整数`
				},
				severity: DiagnosticSeverity.Error,
				location: offset.data.value.location,
			})
		}
	}
	if (file.metadata.data.data.has("TimingPointDensityFactor")) {
		const factor = file.metadata.data.data.get("TimingPointDensityFactor")
		const factorValue = parseFloat(factor.data.value.data)
		if (isNaN(factorValue)) {
			errors.push({
				message: {en: `The value of "TimingPointDensityFactor" metadata is not an float`,
					zh: `TimingPointDensityFactor 值类型应为浮点数`
				},
				severity: DiagnosticSeverity.Error,
				location: factor.data.value.location,
			})
		} else if (factorValue <= 0) {
			errors.push({
				message: {
					en: `The value of "TimingPointDensityFactor" metadata is not positive`,
					zh: `TimingPointDensityFactor 值应为正数`
				},
				severity: DiagnosticSeverity.Error,
				location: factor.data.value.location,
			})
		}
	}
}