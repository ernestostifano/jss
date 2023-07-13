import React, {useEffect, useLayoutEffect, useContext, useRef, useMemo, useDebugValue} from 'react'
import {ThemeContext as DefaultThemeContext} from 'theming'

import JssContext from './JssContext'
import {
  createStyleSheet,
  addDynamicRules,
  updateDynamicRules,
  removeDynamicRules,
  getDynamicRulesClassNames
} from './utils/sheets'
import getSheetIndex from './utils/getSheetIndex'
import {manageSheet, unmanageSheet} from './utils/managers'
import getSheetClasses from './utils/getSheetClasses'

function getUseInsertionEffect(isSSR) {
  return isSSR
    ? useEffect
    : React.useInsertionEffect || // React 18+ (https://github.com/reactwg/react-18/discussions/110)
        useLayoutEffect
}

const noTheme = {}

/*
 * *** NOTE ABOUT STRICT MODE AND REACT 18+ ***
 *
 * IN REACT 18+, WITH STRICT MODE ENABLED, HOOKS WILL NOT BEHAVE AS EXPECTED
 * THE OBJECTIVE IS TO AVOID INVOKING SIDE EFFECTS (INCLUDING MUTATIONS) DURING
 * RENDERING.
 *
 * https://react.dev/reference/react/StrictMode
 * https://react.dev/reference/react/StrictMode#fixing-bugs-found-by-double-rendering-in-development
 * https://react.dev/learn/keeping-components-pure
 * https://legacy.reactjs.org/docs/strict-mode.html#detecting-unexpected-side-effects
 *
 * IN PARTICULAR:
 *
 * - useRef VALUE WILL BE RESET TO THE PREVIOUS VALUE BEFORE THE SECOND RENDER.
 *
 * - useId WILL RETURN A DIFFERENT ID ON SECOND RENDER
 *
 * - useMemo WILL ALWAYS BE TRIGGERED TWICE DURING DOUBLE RENDER (IT IS MEANT ONLY FOR OPTIMISATION
 *   PURPOSES AND IT HAS BEEN DOCUMENTED TO NOT RELY ON THE FACT THAT IT WILL ALWAYS RESPECT DEPS).
 *
 * - useInsertionEffect WILL BE TRIGGERED ONLY ONCE, ON SECOND RENDER AND CLEANUP WILL NOT BE CALLED.
 *
 * - useEffect/useLayoutEffect WILL BE TRIGGERED TWICE, BUT ON SECOND RENDER ONLY (CLEANUP WILL BE CALLED ONCE BETWEEN TRIGGERS).
 *
 * ALL CONSIDERED, IT HAS BEEN PURPOSELY MADE IMPOSSIBLE TO TRIGGER SIDE EFFECTS
 * OUTSIDE THE EFFECT HOOKS WITH PROPER CLEANUP LOGIC. UNFORTUNATELY, DYNAMIC STYLES
 * ADDITION, WITH RESPECTIVE KEYS GENERATION IS A SIDE EFFECT.
 *
 * DEVELOPING WITHOUT STRICT MODE WOULD BE A BIG MISTAKE IN REACT 18+.
 *
 * ADJUSTING react-jss TO WORK PROPERLY AS PER REACT GUIDELINES, THUS BEHAVING
 * AS EXPECTED IN STRICT MODE COULD REQUIRE AN IMPORTANT REFACTOR OF JSS IN GENERAL.
 */

const createUseStyles = (styles, options = {}) => {
  const {index = getSheetIndex(), theming, name, ...sheetOptions} = options
  const ThemeContext = (theming && theming.context) || DefaultThemeContext

  const useTheme = (theme) => {
    if (typeof styles === 'function') {
      return theme || useContext(ThemeContext) || noTheme
    }

    return noTheme
  }

  const emptyObject = {}

  return function useStyles(data) {
    const isFirstMount = useRef(true)
    const context = useContext(JssContext)
    const theme = useTheme(data && data.theme)

    const dynamicRulesRef = useRef(null)

    const sheet = useMemo(() => {
      const newSheet = createStyleSheet({
        context,
        styles,
        name,
        theme,
        index,
        sheetOptions
      })

      if (newSheet && context.isSSR) {
        // manage immediately during SSRs. browsers will manage the sheet through useInsertionEffect below
        manageSheet({
          index,
          context,
          sheet: newSheet,
          theme
        })
      }

      return newSheet
    }, [context, theme])

    const dynamicRulesClassNames = useMemo(
      () => getDynamicRulesClassNames(sheet, context),
      [sheet, context]
    )

    getUseInsertionEffect(context.isSSR)(() => {
      let dynamicRules = null

      if (sheet) {
        dynamicRules = addDynamicRules(sheet, data, dynamicRulesClassNames)
      }

      dynamicRulesRef.current = dynamicRules

      return () => {
        if (dynamicRules) {
          removeDynamicRules(sheet, dynamicRules)
          dynamicRulesRef.current = null
        }
      }
    }, [sheet])

    getUseInsertionEffect(context.isSSR)(() => {
      // We only need to update the rules on a subsequent update and not in the first mount
      if (sheet && dynamicRulesRef.current && !isFirstMount.current) {
        updateDynamicRules(data, sheet, dynamicRulesRef.current)
      }
    }, [data])

    getUseInsertionEffect(context.isSSR)(() => {
      if (sheet) {
        manageSheet({
          index,
          context,
          sheet,
          theme
        })
      }

      return () => {
        if (sheet) {
          unmanageSheet({
            index,
            context,
            sheet,
            theme
          })
        }
      }
    }, [sheet])

    const classes = useMemo(
      () =>
        // TODO: REMOVE dynamicRulesClassNames FROM CHECK?
        sheet && dynamicRulesClassNames
          ? getSheetClasses(sheet, dynamicRulesClassNames)
          : emptyObject,
      [sheet, dynamicRulesClassNames]
    )

    useDebugValue(classes)

    useDebugValue(theme === noTheme ? 'No theme' : theme)

    useEffect(() => {
      isFirstMount.current = false
    }, [])

    return classes
  }
}

export default createUseStyles
