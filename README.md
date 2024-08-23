# A framework agnostic signals package

Written in Typescript, with vanilljs and a react examples
The signals library currently supports processing api request from the following librarys:

Fetch API Response object

Axios or SuperAgent response with `data` property

A response with a `text()` method

A response with a `body` property

## Installation:

npm install @mainframework/signals

yarn add @mainframework/signals

## urls

[npm-url]: https://github.com/TerrySlack/mainframework-signals

## Usage :

### Note:

Whether you interact with the signal directly in vanillajs or use the hook in react, when passing data to set
the set function will handle any merging or overwriting. Especially in the react example where setState looks like
a useStatefunction. The correct way to use it is either signal.set(newvalue) or, in React, setSignal(newValue)
Don't use setSignal((prev)=>{...prev, ...newValue}). This won't work.
Let the Signals library handle it for you

### VanillaJS

import the createSignal function. Pass a value and a cacheId (string), used to prevent duplicate signals from being created.

Use the following signal methods to get, set and destroy a signal

```JS | TS
import { createSignal, destroySignal } from "@mainframework/signals";

//Generate a unique id
 const [uuid] = window.crypto.randomUUID();

//Pass an initalValue to the signal.  It can be a primitive, object, array, promise, or a function that returns a promise
  const signal = createSignal(initialValue, uuid);

  signal.get();  //retreive the signal value
  signal.set(...)  //update the signal value
  destroySignal(uuid) //destroy the signal
```

### React

Signals are only created at the component level to maintain a clean and efficient reactivity model. This design choice ensures that each component is responsible for its state, leading to a predictable and optimized rendering process. Global signals are not currently supported when used with React.

The key to using signals in react is the useSignal hook

You can pass any value to it like primitives, objects, arrays, as well as promises or functions that return
a promise. The library will detect the type of value passed to it and create either a Siganl or an AsyncSignal, with
both returning a value.

On a route change, the hook will destroy any signals created

```JS | TS
import { useEffect } from "react";
import { useSignal } from "@mainframework/signals";

export const App = () => (
  //Signal holding a number
  const [numberSignal, setNumberSignal] = useSignal(0);

  //Signal passing a function that returns a promise from a fetch request
  const [asyncSignal, setAsyncSignal] = useSignal(() =>
    fetch("https://jsonplaceholder.typicode.com/posts/1")
  );

  //Signal passing a promise using axios
  const [axiosSignal] = useSignal(
    axios.get("https://jsonplaceholder.typicode.com/posts/2")
  );

  //Signal passing a promise
  const [numberFromPromiseSignal] = useSignal(
    new Promise((resolve) => {
      resolve(777);
    })
  );

  useEffect(() => {
    //update the Signal or update it in a click event
    setSignal(2);
  }, []);

  //Increment a signal
  const onIncrementClick = (e: MouseEvent<HTMLElement>) => {
    e.preventDefault();
    setSignal(signal + 1);
  };

  return (
    <>
      <div>
        <div>Here's a number signal Value: {numberSignal}</div>
        <hr />
        <button onClick={onIncrementClick}>Increment the signal</button>
      </div>
      <hr />
      <div>Here's a number from a promise signal: {numberFromPromiseSignal}</div>
      <hr />
      <div>Heres the data from the fetch request</div>
      {asyncSignal && <div>{JSON.stringify(asyncSignal)}</div>}

      <hr />
      <div>Here's the data from an axiosSignal</div>
      {axiosSignal && <div>{JSON.stringify(axiosSignal)}</div>}
    </>
  );
);
```
