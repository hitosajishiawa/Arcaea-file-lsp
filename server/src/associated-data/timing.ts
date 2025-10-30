import { AFFTimingEvent, AFFError, WithLocation, AFFContainTiming, AFFNestableItem, AFFItem } from "../types"
import { CstNodeLocation } from "chevrotain"
import { DiagnosticSeverity } from "vscode-languageserver";
import { AssociatedDataMap } from "../util/associated-data";
import { MultiLangString } from "../multiLang";

export interface TimingData {
	time: number,
	bpm: number,
	segment: number,
	item: WithLocation<AFFTimingEvent>,
}

export type TimingResult = {
	datas: TimingData[],//This should be sorted by time
	attributes: string[],
	errors: AFFError[],
}
const genTimingResult = (group: AFFContainTiming): TimingResult => {
	let errors: AFFError[] = []
	let datas = new Map<number, TimingData>()
	let attributes = []

	let items: WithLocation<AFFNestableItem>[] | WithLocation<AFFItem>[];
	let groupLocation: CstNodeLocation;
	let isInTiminggroupMessage: MultiLangString;
	if ("kind" in group) {
		items = group.items.data;
		groupLocation = group.tagLocation;
		isInTiminggroupMessage = {
			en: "in the timinggroup",
			zh: "内"
		};
		if (group.timingGroupAttribute.data.value !== "") {
			attributes.push(...group.timingGroupAttribute.data.value.split("_"))
		}
	}
	else {
		items = group.items;
		groupLocation = group.metadata.data.metaEndLocation;
		isInTiminggroupMessage = {
			en: "outside timinggroups",
			zh: "外"
		};
	}

	for (const item of items) {
		if (item.data.kind === "timing") {
			const time = item.data.time.data.value
			if (datas.has(time)) {
				errors.push({
					message: {
						en: `Another timing at this time is defined previously`,
						zh: `此时间点已定义过 timing`
					},
					severity: DiagnosticSeverity.Error,
					location: item.location,
					relatedInfo: [{
						message: {
							en: `Previous timing definition`,
							zh: `已有 timing`
						},
						location: datas.get(time).item.location
					}]
				})
			} else {
				datas.set(time, {
					time,
					bpm: item.data.bpm.data.value,
					segment: item.data.measure.data.value,
					item: item as WithLocation<AFFTimingEvent>,
				})
			}
		}
	}

	if (datas.size <= 0) {
		errors.push({
			message: {
				en: `No timing event found ${isInTiminggroupMessage.en}`,
				zh: `时间组${isInTiminggroupMessage.zh}应至少声明一个 timing`
			},
			severity: DiagnosticSeverity.Error,
			location: groupLocation
		})
	} else if (!datas.has(0)) {
		errors.push({
			message: {
				en: `No timing event at 0 time found ${isInTiminggroupMessage.en}`,
				zh: `时间组${isInTiminggroupMessage.zh}应声明一个时间点为 0ms 的 timing`
			},
			severity: DiagnosticSeverity.Warning,
			location: groupLocation
		})
	} else {
		let firstZeroTiming = false
		if (items.length >= 0) {
			const first = items[0]
			if (first.data.kind === "timing") {
				if (first.data.time.data.value === 0) {
					firstZeroTiming = true
				}
			}
		}
		if (!firstZeroTiming) {
			errors.push({
				message: {
					en: `First item ${isInTiminggroupMessage.en} is not timing event at 0 time`,
					zh: `时间组${isInTiminggroupMessage.zh}的第一个事件应是时间点为 0ms 的 timing`
				},
				severity: DiagnosticSeverity.Information,
				location: groupLocation
			})
		}
	}

	return { datas: [...datas.values()].sort((a, b) => a.time - b.time), attributes, errors }
}

export const timings = new AssociatedDataMap(genTimingResult)