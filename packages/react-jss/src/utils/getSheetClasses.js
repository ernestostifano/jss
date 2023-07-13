import {getMeta} from './sheetsMeta'

const getSheetClasses = (sheet, dynamicRulesClassNames) => {
  if (!dynamicRulesClassNames) {
    return sheet.classes
  }

  const meta = getMeta(sheet)

  if (!meta) {
    return sheet.classes
  }

  const classes = {}

  for (const key in meta.styles) {
    classes[key] = sheet.classes[key]

    if (key in dynamicRulesClassNames) {
      const k = dynamicRulesClassNames[key].key

      if (sheet.classes[k]) {
        classes[key] += ` ${sheet.classes[k]}`
      } else {
        classes[key] += ` ${dynamicRulesClassNames[key].id}`
      }
    }
  }

  return classes
}

export default getSheetClasses
