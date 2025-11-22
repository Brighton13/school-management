const Sequencer = require('@jest/test-sequencer').default

class CustomSequencer extends Sequencer {
  sort(tests) {
    // Run tests sequentially to avoid database conflicts
    const testArray = Array.from(tests)
    return testArray.sort((testA, testB) => {
      // Define order: admin -> teacher -> class-teacher -> principal -> integration
      const order = {
        'admin-workflow': 1,
        'teacher-workflow': 2,
        'class-teacher-workflow': 3,
        'principal-workflow': 4,
        'integration-workflow': 5,
      }
      
      const getOrder = (path) => {
        for (const [key, value] of Object.entries(order)) {
          if (path.includes(key)) return value
        }
        return 999
      }
      
      return getOrder(testA.path) - getOrder(testB.path)
    })
  }
}

module.exports = CustomSequencer

