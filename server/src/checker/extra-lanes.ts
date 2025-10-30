
import { DiagnosticSeverity } from "vscode-languageserver"
import { EnwidenData, enwidens } from "../associated-data/enwiden"
import { AFFChecker } from "../types"
import { lowerBound, upperBound } from "../util/misc"

export const extraLanesChecker: AFFChecker = (file, errors) => {
	const lanes = enwidens.get(file).lanes
	for (const item of file.items) {
		if (item.data.kind === "tap") {
			const trackId = item.data.trackId
			if (trackId.data.value === 0 || trackId.data.value === 5) {
				let lastEnwidenlaneId = upperBound(lanes, item.data.time.data.value, (ed, t) => ed.time - t) - 1
				if (lastEnwidenlaneId >= 0) {
					if (!lanes[lastEnwidenlaneId].enabled && lanes[lastEnwidenlaneId].time === item.data.time.data.value) {
						lastEnwidenlaneId -= 1
					}
				}
				if (!(lanes[lastEnwidenlaneId]?.enabled ?? false)) {
					errors.push({
						message: {
							en: `The tap item on the ${trackId.data.value} lane should not present when enwidenlanes is disabled`,
							zh: `禁用 enwidenlanes 时 ${trackId.data.value} 号轨道不应该出现 tap`
						},
						severity: DiagnosticSeverity.Error,
						location: trackId.location,
						relatedInfo: [{
							message: {
								en: `The scenecontrol event that disable enwidenlanes`,
								zh: `禁用 enwidenlanes 的 scenecontrol 事件`
							},
							location: lanes[lastEnwidenlaneId]?.item?.location ?? file.metadata.data.metaEndLocation,
						}],
					})
				}
			}
		} else if (item.data.kind === "hold") {
			const trackId = item.data.trackId
			if (trackId.data.value === 0 || trackId.data.value === 5) {
				const firstEnwidenlaneId = upperBound(lanes, item.data.start.data.value, (ed, t) => ed.time - t) - 1
				const lastEnwidenlaneId = lowerBound(lanes, item.data.end.data.value, (ed, t) => ed.time - t)
				const disabler: (EnwidenData | null)[] = lanes.slice(Math.max(firstEnwidenlaneId, 0), lastEnwidenlaneId)
					.filter((lane) => !lane.enabled)
				if (firstEnwidenlaneId < 0) {
					disabler.unshift(null)
				}
				if (disabler.length > 0) {
					errors.push({
						message: {
							en: `The hold item on the ${trackId.data.value} lane should not present when enwidenlanes is disabled`,
							zh: `禁用 enwidenlanes 时 ${trackId.data.value} 号轨道不应该出现 hold`
						},
						severity: DiagnosticSeverity.Error,
						location: trackId.location,
						relatedInfo: disabler.map(lane => ({
							message: {
								en: `The scenecontrol event that disable enwidenlanes`,
								zh: `禁用 enwidenlanes 的 scenecontrol 事件`
							},
							location: lane?.item?.location ?? file.metadata.data.metaEndLocation,
						})),
					})

				}
			}
		}
	}
}