import { DiagnosticSeverity } from "vscode-languageserver"
import { CstNodeLocation } from "chevrotain"
import { AFFChecker, AFFError, AFFItem, isLine, WithLocation } from "../types"
import { allowMemes } from "../associated-data/allow-memes"
import { EnwidenData, enwidens } from "../associated-data/enwiden"
import { upperBound } from "../util/misc"
import { MultiLangString } from "../multiLang"
import { Difficulty } from "../difficulty"

export const arcPositionChecker: AFFChecker = (file, errors, difficulty) => {
	if (allowMemes.get(file).enable) {
		return
	}
	const cameras = enwidens.get(file).cameras
	for (const item of file.items) {
		checkItem(item, cameras, errors, difficulty)
	}
}

enum rangeKind {
	standard,
	past,
	eternal,
	beyond,
	enwidencamera,
	track
}

const ranges: Map<rangeKind, ((x: number, y: number) => boolean)> = new Map();
// for regular charts, vertices = [(-0.50,0.00), (1.50,0.00), (0.00,1.00), (1.00,1.00)]
ranges.set(
	rangeKind.standard,
	(x, y) => (
		Math.round(100 * y) <= 100 &&
		Math.round(100 * y) >= 0 &&
		Math.round(200 * x + 100 * y) <= 300 &&
		Math.round(200 * x - 100 * y) >= -100
	)
);
// for PST charts, vertices = [(0.00,1.00), (1.00,1.00)]
ranges.set(
	rangeKind.past,
	(x, y) => (
		Math.round(100 * y) === 100 &&
		Math.round(100 * x) >= 0 &&
		Math.round(100 * x) <= 100
	)
);
// for ETR charts, vertices = [(-0.50,0.00), (1.50,0.00), (-0.25,1.00), (1.25,1.00)]
ranges.set(
	rangeKind.eternal,
	(x, y) => (
		Math.round(100 * y) <= 100 &&
		Math.round(100 * y) >= 0 &&
		Math.round(400 * x - 100 * y) >= -200 &&
		Math.round(400 * x + 100 * y) <= 600
	)
);
// for BYD charts, vertices = [(-0.50,0.00), (1.50,0.00), (-0.25,1.50), (1.25,1.50)]
ranges.set(
	rangeKind.beyond,
	(x, y) => (
		Math.round(100 * y) <= 150 &&
		Math.round(100 * y) >= 0 &&
		Math.round(600 * x - y) >= -300 &&
		Math.round(600 * x + y) <= 900
	)
)
// for enwidencamera, vertices = [(-1.00,0.00), (2.00,0.00), (-0.25,1.61), (1.25,1.61)]
ranges.set(
	rangeKind.enwidencamera,
	(x, y) => (
		Math.round(100 * y) <= 161 &&
		Math.round(100 * y) >= 0 &&
		Math.round(16100 * x + 7500 * y) <= 32200 &&
		Math.round(16100 * x - 7500 * y) >= -16100
	)
);
// for tracking arc, currently no constraints
ranges.set(
	rangeKind.track,
	() => true
);

enum PointTag {
	start,
	end
}

const checkItem = ({ data, location }: WithLocation<AFFItem>, cameras: EnwidenData[], errors: AFFError[], difficulty: Difficulty) => {
	if (data.kind === "arc") {
		const solid = !isLine(data.lineKind.data)
		checkPoint(PointTag.start, solid, data.xStart.data.value, data.yStart.data.value, data.start.data.value, cameras, location, errors, difficulty)
		checkPoint(PointTag.end, solid, data.xEnd.data.value, data.yEnd.data.value, data.end.data.value, cameras, location, errors, difficulty)
	} else if (data.kind === "timinggroup") {
		for (const item of data.items.data) {
			checkItem(item, cameras, errors, difficulty)
		}
	}
}

const checkPoint = (tag: PointTag, solid: boolean, x: number, y: number, time: number, cameras: EnwidenData[], location: CstNodeLocation, errors: AFFError[], difficulty: Difficulty) => {
	let lastEnwidenCameraId = upperBound(cameras, time, (ec, t) => ec.time - t) - 1
	if (lastEnwidenCameraId >= 0) {
		if (!cameras[lastEnwidenCameraId].enabled && cameras[lastEnwidenCameraId].time === time) {
			lastEnwidenCameraId -= 1
		}
	}
	let tagMessage: MultiLangString = (tag === PointTag.start) ? { en: "start point", zh: "起点" } : { en: "end point", zh: "终点" };

	if (solid) {
		let inRange: boolean;
		if (!(cameras[lastEnwidenCameraId]?.enabled ?? false)) {
			switch (difficulty) {
				case Difficulty.PST:
					inRange = ranges.get(rangeKind.standard)(x, y)
				case Difficulty.ETR:
					inRange = ranges.get(rangeKind.eternal)(x, y)
					break
				case Difficulty.BYD:
					inRange = ranges.get(rangeKind.beyond)(x, y)
					break
				case Difficulty.PRS:
				case Difficulty.FTR:
					inRange = ranges.get(rangeKind.standard)(x, y)
					break
			}
		}
		else {  // camera enwiden
			inRange = ranges.get(rangeKind.enwidencamera)(x, y)
		}
		if (!inRange) {
			errors.push({
				message: {
					en: `The ${tagMessage.en} of the solid arc is out of constraints`,
					zh: `音弧的${tagMessage.zh}超界`
				},
				severity: DiagnosticSeverity.Warning,
				location
			})
		}
	}
	else {  // tracking arc
		if (!ranges.get(rangeKind.track)(x, y)) {
			errors.push({
				message: {
					en: `The ${tagMessage.en} of the tracking arc is out of constraints`,
					zh: `音轨的${tagMessage.zh}超界`
				},
				severity: DiagnosticSeverity.Information,
				location
			})
		}
	}
}