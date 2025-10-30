import { AFFChecker, WithLocation, AFFSceneControlKind, AFFValue, AFFError, AFFValues } from "../types"
import { DiagnosticSeverity } from "vscode-languageserver"
import { CstNodeLocation } from "chevrotain"

export const scenecontrolChecker: AFFChecker = (file, errors) => {
	for (const { data } of file.items) {
		if (data.kind === "scenecontrol") {
			checkScenecontrol(data.sceneControlKind, data.values, errors)
		} else if (data.kind === "timinggroup") {
			for (const nestedItem of data.items.data) {
				if (nestedItem.data.kind === "scenecontrol") {
					checkScenecontrol(nestedItem.data.sceneControlKind, nestedItem.data.values, errors)
				}
			}
		}
	}
}

const checkScenecontrol = (kind: WithLocation<AFFSceneControlKind>, values: WithLocation<WithLocation<AFFValue>[]>, error: AFFError[]) => {
	if (kind.data.value === "trackshow" || kind.data.value === "trackhide") {
		checkValuesCount(error, kind.data.value, 0, values.data, values.location)
		return
	}
	if (
		kind.data.value === "redline" ||
		kind.data.value === "arcahvdistort" ||
		kind.data.value === "arcahvdebris" ||
		kind.data.value === "hidegroup" ||
		kind.data.value === "enwidencamera" ||
		kind.data.value === "enwidenlanes" ||
		kind.data.value === "trackdisplay"
	) {
		if (checkValuesCount(error, kind.data.value, 2, values.data, values.location)) {
			checkValueType(error, kind.data.value, "length", "float", values.data, 0)
			checkValueType(error, kind.data.value, "value", "int", values.data, 1)
		}
		return
	}
	error.push({
		message: {
			en: `Scenecontrol event with type "${kind.data.value}" is not known by us, so the type of additional values is not checked`,
			zh: `未知的 scenecontrol 类型 "${kind.data.value}" ，因此不检查额外参数类型`
		},
		location: kind.location,
		severity: DiagnosticSeverity.Warning,
	})
}

const checkValuesCount = (errors: AFFError[], kind: string, count: number, values: WithLocation<AFFValue>[], valuesLocation: CstNodeLocation): boolean => {
	if (values.length !== count) {
		// error: value count mismatch
		errors.push({
			message: {
				en: `Scenecontrol event with type "${kind}" should have ${count} additional value(s) instead of ${values.length} additional value(s)`,
				zh: `类型为 "${kind}" 的 scenecontrol 事件应当有 ${count} 个额外参数，而实际上有 ${values.length} 个额外参数`
			},
			location: valuesLocation,
			severity: DiagnosticSeverity.Error,
		})
		return false
	}
	return true
}

const checkValueType = <T extends keyof AFFValues>(
	errors: AFFError[],
	eventKind: string,
	fieldName: string,
	kind: T,
	values: WithLocation<AFFValue>[],
	id: number
): WithLocation<AFFValues[T]> | null => {
	const value = values[id]
	if (value.data.kind !== kind) {
		// error: value type mismatch
		errors.push({
			message: {
				en: `The value in the "${fieldName}" field of scenecontrol event with type "${eventKind}" should be "${kind}" instead of "${value.data.kind}"`,
				zh: `类型为 "${eventKind}" 的 scenecontrol 事件的 "${fieldName}" 字段应当为 "${kind}" 类型，而非 "${value.data.kind}" 类型`
			},
			location: values[id].location,
			severity: DiagnosticSeverity.Error,
		})
		return null
	} else {
		return value as WithLocation<AFFValues[T]>
	}
}