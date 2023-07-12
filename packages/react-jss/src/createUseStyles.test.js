/* eslint-disable react/prop-types */

import * as React from 'react'
import ReactDOM from 'react-dom/client'
import ReactTestUtils from 'react-dom/test-utils'
import {renderToString} from 'react-dom/server'
import TestRenderer from 'react-test-renderer'
import expect from 'expect.js'
import {stripIndent} from 'common-tags'
import createCommonBaseTests from '../test-utils/createCommonBaseTests'
import {createUseStyles, JssProvider, SheetsRegistry} from '.'

const createStyledComponent = (styles, options) => {
  const useStyles = createUseStyles(styles, options)
  const Comp = ({getClasses, ...restProps}) => {
    const classes = useStyles(restProps)
    if (getClasses) {
      getClasses(classes)
    }
    return null
  }
  return Comp
}

describe('React-JSS: createUseStyles', () => {
  createCommonBaseTests({createStyledComponent})

  describe('theme prop', () => {
    it('should pass theme from props priority', () => {
      const registry = new SheetsRegistry()

      const styles = (theme) => ({
        button: {color: theme.exampleColor || 'green'}
      })

      const MyComponent = createStyledComponent(styles)

      renderToString(
        <JssProvider registry={registry} generateId={() => 'button'} isSSR>
          <MyComponent theme={{exampleColor: 'blue'}} />
        </JssProvider>
      )
      expect(registry.toString()).to.be(stripIndent`
      .button {
        color: blue;
      }
    `)
    })
  })

  describe('multiple components that share same hook', () => {
    const useStyles = createUseStyles({
      item: (props) => ({
        color: props.active ? 'red' : 'blue',
        '&:hover': {
          fontSize: 60
        }
      })
    })

    function Item({active = false, onClick, children}) {
      const classes = useStyles({active})
      return (
        <button type="button" className={classes.item} onClick={onClick}>
          {children}
        </button>
      )
    }

    function App() {
      const [activeKey, setActiveKey] = React.useState(1)
      return (
        <main>
          {[1, 2].map((key) => (
            <Item key={key} active={key === activeKey} onClick={() => setActiveKey(key)}>
              {key}
            </Item>
          ))}
        </main>
      )
    }

    let registry
    let root
    beforeEach(() => {
      registry = new SheetsRegistry()

      TestRenderer.act(() => {
        root = TestRenderer.create(
          <JssProvider registry={registry} generateId={(rule) => `${rule.key}-id`}>
            <App />
          </JssProvider>
        )
      })
    })

    it('should return correct registry.toString at first render', () => {
      expect(registry.toString()).to.be(stripIndent`
        .item-id {}
        .item-d0-id {
          color: red;
        }
        .item-d0-id:hover {
          font-size: 60px;
        }
        .item-d1-id {
          color: blue;
        }
        .item-d1-id:hover {
          font-size: 60px;
        }
      `)
    })

    it('should return correct registry.toString after update via click', () => {
      TestRenderer.act(() => {
        root.root.findAllByType('button')[1].props.onClick()
      })

      expect(registry.toString()).to.be(stripIndent`
        .item-id {}
        .item-d0-id {
          color: blue;
        }
        .item-d0-id:hover {
          font-size: 60px;
        }
        .item-d1-id {
          color: red;
        }
        .item-d1-id:hover {
          font-size: 60px;
        }
      `)
    })
  })

  describe('empty object', () => {
    it('should return same empty object when disableStylesGeneration is true', () => {
      const MyComponent = createStyledComponent()

      const classes = []

      const getClasses = (currentClasses) => {
        classes.push(currentClasses)
      }

      let root
      TestRenderer.act(() => {
        root = TestRenderer.create(
          <JssProvider disableStylesGeneration>
            <MyComponent getClasses={getClasses} />
          </JssProvider>
        )
      })

      TestRenderer.act(() => {
        root.update(
          <JssProvider disableStylesGeneration>
            <MyComponent getClasses={getClasses} />
          </JssProvider>
        )
      })

      expect(classes[0]).to.be(classes[1])
    })
  })

  describe('undesirable re-render', () => {
    it("should return previous classes when sheet and dynamicRules haven't change", () => {
      const MyComponent = createStyledComponent()

      const classes = []

      const getClasses = (currentClasses) => {
        classes.push(currentClasses)
      }

      let root
      TestRenderer.act(() => {
        root = TestRenderer.create(<MyComponent getClasses={getClasses} />)
      })

      TestRenderer.act(() => {
        root.update(<MyComponent getClasses={getClasses} />)
      })

      expect(classes[0]).to.be(classes[1])
    })
  })

  describe('strict mode', () => {
    // USING react-test-renderer DOES NOT ENABLE REACT STRICT MODE
    // TESTS HAVE BEEN CONFIGURED MANUALLY SINCE REACT TESTING LIBRARY IS NOT BEING USED
    // https://legacy.reactjs.org/docs/strict-mode.html#ensuring-reusable-state

    let container = null

    beforeEach(() => {
      container = document.createElement('div')

      document.body.appendChild(container)

      global.IS_REACT_ACT_ENVIRONMENT = true
    })

    afterEach(() => {
      global.IS_REACT_ACT_ENVIRONMENT = false

      document.body.removeChild(container)
      container = null
    })

    const prepare = (styles) => {
      const useStyles = createUseStyles(styles)

      const registry = new SheetsRegistry()

      const ctx = {
        ids: {
          button: null
        },
        renders: {
          current: 0,
          previous: 0
        }
      }

      const Item = () => {
        const classes = useStyles()
        return <span className={classes.item}>Item</span>
      }

      const App = () => {
        const [show, setShow] = React.useState(false)

        ctx.ids.button = React.useId()

        ctx.renders.current++

        return (
          <main>
            <button
              id={ctx.ids.button}
              type="button"
              onClick={() => setShow((prevState) => !prevState)}
            >
              {'toggle'}
            </button>

            {show ? <Item /> : null}
          </main>
        )
      }

      const render = () => {
        ReactTestUtils.act(() => {
          ReactDOM.createRoot(container).render(
            <React.StrictMode>
              <JssProvider registry={registry}>
                <App />
              </JssProvider>
            </React.StrictMode>
          )
        })

        // ASSERT STRICT MODE
        expect(ctx.renders.current - ctx.renders.previous).to.equal(2)

        ctx.renders.previous = ctx.renders.current
      }

      const toggle = () => {
        if (ctx.ids.button) {
          ReactTestUtils.act(() => {
            document
              .getElementById(ctx.ids.button)
              .dispatchEvent(new MouseEvent('click', {bubbles: true}))
          })

          // ASSERT STRICT MODE
          expect(ctx.renders.current - ctx.renders.previous).to.equal(2)

          ctx.renders.previous = ctx.renders.current
        }
      }

      const countStyleRules = () => {
        let count = 0

        for (let i = 0; i < registry.registry.length; i++) {
          count += registry.registry[i].rules.index.length
        }

        return count
      }

      return {
        registry,
        render,
        toggle,
        countStyleRules
      }
    }

    it('should properly cleanup dynamic styles when unmount', () => {
      const {registry, render, toggle, countStyleRules} = prepare({
        item: () => ({
          color: '#ffffff'
        })
      })

      render()

      expect(registry.registry.length).to.equal(0)
      expect(countStyleRules()).to.equal(0)

      for (let i = 0; i < 20; i++) {
        toggle()

        expect(registry.registry.length).to.equal(1)
        expect(countStyleRules()).to.equal(2) // CONSIDERS EMPTY STATIC STYLE

        toggle()

        expect(registry.registry.length).to.equal(1)
        expect(countStyleRules()).to.equal(1) // DYNAMIC STYLE GETS REMOVED
      }

      expect(registry.registry.length).to.equal(1)
      expect(countStyleRules()).to.equal(1) // DYNAMIC STYLE GETS REMOVED
    })
  })
})
