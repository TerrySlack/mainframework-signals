import { useCallback, useRef, useState } from 'react'
import { useTaskQueue } from '../providers/ApiWorkerProvider'

/*
  This hook is like useState.  If you want to re-use it, you need to declare it.  It can't be created once and re-used
*/

export interface UseApiworker {
  data: unknown
  makeRequest: () => void
}

export const useApiWorker = <T>(requestObject: T): [T, () => void] => {
  const { addToQueue } = useTaskQueue()
  const [data, setData] = useState<any>(undefined)

  //Generate the id once
  const uuidRef = useRef<string>(self.crypto.randomUUID())

  //const makeRequest:Dispatch<SetStateAction<T>> = useCallback(() => {
  const makeRequest = useCallback(() => {
    /*
      Note: randomUUID is significantly faster than libraries like uuid or nanoid.  Google it.

      we add this unique id, in order to keep track of data returned from the worker, and return it to the proper hook instance that called it.
    */
    addToQueue(setData, uuidRef.current, requestObject)
  }, [requestObject, addToQueue])
  return [data, makeRequest]
}
