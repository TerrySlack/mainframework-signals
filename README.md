# create an npm package

## Installation:

npm install package-name
yarn pacakge-name

## urls
[npm-url]: https://www.npmjs.com/package/@mainframework/api-reqpuest-provider-worker-hook



## Usage :

## App.tsx

Wrap your application with the ApiWorkerProvider

```JS | TS
import {App} from "./App";
import { ApiWorkerProvider } from "@mainframework/api-reqpuest-provider-worker-hook";

export const App = () => (
  <ApiWorkerProvider>
    <App />
  </ApiWorkerProvider>
);
```

## making a request

In a component, where you need to make a request, use the useApiWorker hook for each request.
You can use multiple instances of the hook, and make: get, post, patch and delete reqeusts

```JS | TS
import { useEffect } from "react";
import { useApiWorker } from "@mainframework/api-reqpuest-provider-worker-hook";

export const App = () => (
 const [todos, todosRequest] = useApiWorker({
    type: "Get",
    url: "https://jsonplaceholder.typicode.com/todos/1",
    "x-api-key":
      "live_YedloihKi9ObVaF7LovnmMzpe6PYkvT6NpZhRupWl0Z6VDi9WWTpHk6zqlsaqi7z",
  });

  const [cats, catRequest] = useApiWorker({
    type: "Get",
    url: "https://api.thecatapi.com/v1/images/search?limit=10",
  });

  const [posts, postsRequest] = useApiWorker({
    type: "Post",
    url: "https://jsonplaceholder.typicode.com/posts",
    payload:{
      title: 'foo',
      body: 'bar',
      userId: 1,
    },headers: {
        "Content-type": "application/json; charset=UTF-8"
    },
  });

  useEffect(() => {
    catRequest();
    todosRequest();
    postsRequest();
  }, []);

  return (
    <div>
      {todos && (
        <div>
          <span>Todos</span>
          <div>{JSON.stringify(todos)}</div>
        </div>
      )}
      <hr />
      {cats && (
        <div>
          <span>Cats</span>
          <div>{JSON.stringify(cats)}</div>
        </div>
      )} <hr />
      {posts && (
        <div>
          <span>Posts</span>
          <div>{JSON.stringify(posts)}</div>
        </div>
      )}
    </div>
  );
);
```
