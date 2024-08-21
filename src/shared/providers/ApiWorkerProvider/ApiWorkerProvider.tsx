/*eslint-disable */
import { Dispatch, ReactNode, SetStateAction, createContext, useContext } from 'react'

// Create the worker once outside the hook
const apiWorker = new Worker(new URL('../../workers/api/api.worker', import.meta.url))

interface QueueContextType {
  addToQueue: (
    callback: (data: Dispatch<SetStateAction<undefined>> | unknown) => void,
    id: string | number,
    data: unknown,
  ) => void
}

interface Provider {
  children: ReactNode
}
// Define types for task and task queue
interface Task {
  callback: (data: unknown, id: string) => void
}

interface TaskQueue {
  [id: string | number]: Task
}

const addToQueue = (callback: (data: unknown) => void, id: string | number, data: unknown) => {
  //Check to ensure that a re-render isn't adding a duplicate task.
  const task = taskQueue[id]

  //Duplicate, due to a re-render.  We only want to make one request.
  if (task) return

  //task doesn't exist, add to the queue
  taskQueue[id] = { callback }

  // Call the worker to process the task immediately upon adding it to the queue
  apiWorker.postMessage({ data, id })
}

// Create a context for the task queue
const TaskQueueContext = createContext<QueueContextType>({
  /* eslint-disable @typescript-eslint/no-unused-vars */
  addToQueue: (
    _: (data: Dispatch<SetStateAction<undefined>> | unknown) => void,
    _id: string | number,
    _data: unknown,
  ) => {
    throw new Error('addToQueue must be implemented')
  },
})
/* eslint-enable @typescript-eslint/no-unused-vars */

const taskQueue: TaskQueue = {}

// Custom provider component
export const ApiWorkerProvider = ({ children }: Provider) => {
  //Create and assign the onMessage function once.
  if (!apiWorker.onmessage) {
    apiWorker.onmessage = (event: MessageEvent) => {
      const { data, id } = event.data

      //Get the task from the taskQuer
      const task = taskQueue[id]

      if (task) {
        //Get the callback to pass information back
        const { callback } = task
        
        //delete the task from the queue
        delete taskQueue[id]

        //Pass the data back to the callback
        callback(data, id)
      }
    }
  }

  return <TaskQueueContext.Provider value={{ addToQueue }}>{children}</TaskQueueContext.Provider>
}

// Custom hook to access TaskQueueContext
export const useTaskQueue = () => useContext(TaskQueueContext)
