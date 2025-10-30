import { DiagnosticSeverity } from "vscode-languageserver"
import { CstNodeLocation } from "chevrotain"
import { AFFChecker, AFFError, AFFItem, isLine, WithLocation } from "../types"
import { allowMemes } from "../associated-data/allow-memes"
import { EnwidenData, enwidens } from "../associated-data/enwiden"
import { upperBound } from "../util/misc"
import { MultiLangString } from "../multiLang"

export const arcPositionChecker: AFFChecker = (file, errors) => {
	if (allowMemes.get(file).enable) {
		return
	}
	const cameras = enwidens.get(file).cameras
	for (const item of file.items) {
		checkItem(item, cameras, errors)
	}
}

enum PointTag {
	start,
	end
}

const checkItem = ({ data, location }: WithLocation<AFFItem>, cameras: EnwidenData[], errors: AFFError[]) => {
	if (data.kind === "arc") {
		const solid = !isLine(data.lineKind.data)
		checkPoint(PointTag.start, solid, data.xStart.data.value, data.yStart.data.value, data.start.data.value, cameras, location, errors)
		checkPoint(PointTag.end, solid, data.xEnd.data.value, data.yEnd.data.value, data.end.data.value, cameras, location, errors)
	} else if (data.kind === "timinggroup") {
		for (const item of data.items.data) {
			checkItem(item, cameras, errors)
		}
	}
}

const checkPoint = (tag: PointTag, solid: boolean, x: number, y: number, time: number, cameras: EnwidenData[], location: CstNodeLocation, error: AFFError[]) => {
	let lastEnwidenCameraId = upperBound(cameras, time, (ec, t) => ec.time - t) - 1
	if (lastEnwidenCameraId >= 0) {
		if (!cameras[lastEnwidenCameraId].enabled && cameras[lastEnwidenCameraId].time === time) {
			lastEnwidenCameraId -= 1
		}
	}
	let tagMessage: MultiLangString = (tag === PointTag.start) ? { en: "start point", zh: "起点" } : { en: "end point", zh: "终点" };
	if (!(cameras[lastEnwidenCameraId]?.enabled ?? false)) {
		if (
			Math.round(100 * y) > 100 ||
			Math.round(100 * y) < 0 ||
			Math.round(200 * x + 100 * y) > 300 ||
			Math.round(200 * x - 100 * y) < -100
		) {
			error.push({
				message: {
					en: `The ${tagMessage.en} of the ${solid ? "solid" : "tracking"} arc is out of the trapezium range`,
					zh: `${solid ? "音弧" : "音轨（黑线）"}的${tagMessage.zh}超界`
				},
				severity: solid ? DiagnosticSeverity.Warning : DiagnosticSeverity.Hint,
				location,
			})
		}
	} else {
		if (
			Math.round(100 * y) > 161 ||
			Math.round(100 * y) < 0 ||
			Math.round(16100 * x + 7500 * y) > 32200 ||
			Math.round(16100 * x - 7500 * y) < -16100
		) {
			error.push({
				message: {
					en: `The ${tagMessage.en} of the ${solid ? "solid" : "tracking"} arc is out of the trapezium range`,
					zh: `${solid ? "音弧" : "轨道（黑线）"}的${tagMessage.zh}超界`
				},
				severity: solid ? DiagnosticSeverity.Warning : DiagnosticSeverity.Hint,
				location,
			})
		}
	}
}