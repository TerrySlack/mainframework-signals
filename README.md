# A framework agnostic signasl package

Written in Typescript, with vanilljs and a react examples
The signals library currently supports processing api request from the following librarys:
Fetch API Response object
Axios or SuperAgent response with `data` property
A response with a `text()` method (like some other libraries)
A response with a `body` property
A response with the text property: Ie. XML

## Installation:

npm install package-name
yarn pacakge-name

## urls

[npm-url]: https://github.com/TerrySlack/mainframework-signals

## Usage :

### VanillaJS

import the createSignal function. Pass a value and a cacheId (string), used to prevent duplicate signals from being created

```JS | TS
//Generate a unique id
 const [uuidRef] = useState<string>(() => window.crypto.randomUUID());

//Pass an initalValue to the signal.  It can be a primitive, object, array, promise, or a function that returns a promise
  const signal = createSignal(initialValue, uuidRef);

  signal.get();  //retreive the signal value
  signal.set(...)  //update the signal value
```

### React

To use the signals, in react, add the package to your dependencies. Import the hook and use it.
You can pass any value to it like primitives, objecgts, arrays, as well as promises or functions that return
a promise. The library will detect the type of value passed to it and create either a Siganl or an AsyncSignal, with
both returning a value.

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
