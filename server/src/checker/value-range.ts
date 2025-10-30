import { DiagnosticSeverity } from "vscode-languageserver"
import { AFFChecker, AFFInt, AFFError, WithLocation, AFFItem, isLine } from "../types"

export const valueRangeChecker: AFFChecker = (file, errors) => {
	for (const item of file.items) {
		checkItem(item, errors)
	}
}

const checkItem = ({ data, location }: WithLocation<AFFItem>, errors: AFFError[]) => {
	if (data.kind === "timing") {
		checkTimestamp(data.time, errors)
		if (data.bpm.data.value !== 0 && data.measure.data.value === 0) {
			errors.push({
				message: {
					en: `Timing event with non-zero bpm should not have zero beats per segment`,
					zh: `Timing 的 BPM 不为 0 时，拍号不应为 0`
				},
				severity: DiagnosticSeverity.Error,
				location: data.measure.location,
			})
		}
		if (data.bpm.data.value === 0 && data.measure.data.value !== 0) {
			errors.push({
				message: {
					en: `Timing event with zero bpm should have zero beats per segment`,
					zh: `Timing 的 BPM 为 0 时，拍号应为 0`
				},
				severity: DiagnosticSeverity.Information,
				location: data.measure.location,
			})
		}
	} else if (data.kind === "tap") {
		checkTimestamp(data.time, errors)
	} else if (data.kind === "hold") {
		checkTimestamp(data.start, errors)
		checkTimestamp(data.end, errors)
		if (data.start.data.value >= data.end.data.value) {
			errors.push({
				message: {
					en: `Hold event should have a positive time length`,
					zh: `Hold 的起始时间应小于结束时间`
				},
				severity: DiagnosticSeverity.Error,
				location: location,
			})
		}
	} else if (data.kind === "arc") {
		checkTimestamp(data.start, errors)
		checkTimestamp(data.end, errors)
		if (data.start.data.value > data.end.data.value) {
			errors.push({
				message: {
					en: `Arc event should have a non-negative time length`,
					zh: `Arc 的起始时间应小于或等于结束时间`
				},
				severity: DiagnosticSeverity.Error,
				location: location,
			})
		}
		if (data.start.data.value === data.end.data.value) {
			if (data.xStart.data.value === data.xEnd.data.value && data.yStart.data.value === data.yEnd.data.value) {
				errors.push({
					message: {
						en: `Arc event with zero time length should have different start point and end point`,
						zh: `0ms 的 arc 起始点和结束点应不同`
					},
					severity: DiagnosticSeverity.Error,
					location: location,
				})
			}
			if (data.curveKind.data.value !== "s") {
				errors.push({
					message: {
						en: `Arc event with zero time length should be "s" type`,
						zh: `0ms 的 arc 类型应为 "s"`
					},
					severity: DiagnosticSeverity.Information,
					location: data.curveKind.location,
				})
			}
			if (data.arctaps) {
				errors.push({
					message: {
						en: `Arc event with zero time length should not have arctap events on it`,
						zh: `0ms 的 arc 不应有 Arctap`
					},
					severity: DiagnosticSeverity.Error,
					location: data.arctaps.location,
				})
			}
		}
		if (data.effect.data.value !== "none" && !data.effect.data.value.endsWith("_wav")) {
			errors.push({
				message: {
					en: `Arc event with effect "${data.effect.data.value}" is not known by us`,
					zh: `未知的 arc 效果 "${data.effect.data.value}"`
				},
				severity: DiagnosticSeverity.Warning,
				location: data.effect.location,
			})
		}
		if (!isLine(data.lineKind.data) && data.arctaps) {
			errors.push({
				message: {
					en: `Arc event with arctap events on it will be treated as not solid even it is specified as solid`,
					zh: `带有 arctap 的 arc 总被解释为音轨（黑线），即使声明其为音弧`
				},
				severity: DiagnosticSeverity.Warning,
				location: data.lineKind.location,
			})
		}
		if (!isLine(data.lineKind.data) && data.arctaps === undefined && data.colorId.data.value >= 4) {
			errors.push({
				message: {
					en: `Solid arc event should not use the color ${data.colorId.data.value}`,
					zh: `音弧不应声明其颜色代号为 ${data.colorId.data.value}`
				},
				severity: DiagnosticSeverity.Error,
				location: data.colorId.location,
			})
		}
		if (data.smoothness) {
			if (data.smoothness.data.value < 1) {
				errors.push({
					message: {
						en: `Arc smoothness with value less than 1 will be ignored`,
						zh: `Arc 的平滑度参数小于 1 无效，将被忽略`
					},
					severity: DiagnosticSeverity.Warning,
					location: data.smoothness.location,
				})
			}
		}
		if (data.arctaps) {
			for (const arctap of data.arctaps.data) {
				if (arctap.data.time.data.value < data.start.data.value || arctap.data.time.data.value > data.end.data.value) {
					errors.push({
						message: {
							en: `Arctap event should happens in the time range of parent arc event`,
							zh: `Arctap 必须在其父 arc 的时间范围内`
						},
						severity: DiagnosticSeverity.Error,
						location: arctap.location,
					})
				}
			}
		}
	} else if (data.kind === "camera") {
		checkTimestamp(data.time, errors)
		if (data.duration.data.value < 0) {
			errors.push({
				message: {
					en: `Camera event should have non negative duration`,
					zh: `Camera 的持续时间应为非负数`
				},
				severity: DiagnosticSeverity.Error,
				location: data.duration.location,
			})
		}
	} else if (data.kind === "scenecontrol") {
		checkTimestamp(data.time, errors)
		const kind = data.sceneControlKind.data.value
		if (["enwidencamera", "enwidenlanes", "trackdisplay"].includes(kind)) {
			const values = data.values;
			if (values.data.length === 2) {
				if (values.data[0].data.kind == "float" && values.data[1].data.kind == "int") {
					if (values.data[0].data.value <= 0) {
						errors.push({
							message: {
								en: `The scenecontrol item with kind "${kind}" should have non negative duration`,
								zh: `类型为 "${kind}" 的 scenecontrol 持续时间应为非负数`
							},
							severity: DiagnosticSeverity.Error,
							location: values.data[0].location,
						})
					}
				}
			}
		}
	} else if (data.kind === "timinggroup") {
		for (const item of data.items.data) {
			checkItem(item, errors)
		}
	}
}

const checkTimestamp = (timestamp: WithLocation<AFFInt>, errors: AFFError[]) => {
	if (timestamp.data.value < 0) {
		errors.push({
			message: {
				en: `Timestamp should not be negative`,
				zh: `时间戳不能为负数`
			},
			severity: DiagnosticSeverity.Error,
			location: timestamp.location,
		})
	}
}