import React, { createContext, useContext } from "react";

/*
  TODO: IndexedDb is async API. We don't want this. Probably we should use SQLite with OPFS.
    https://rxdb.info/slow-indexeddb.html
  TODO: Multiple tabs should somehow elect a leader
    https://github.com/pubkey/broadcast-channel#using-the-leaderelection
 */

const emptySymbol = Symbol("LocalFirstContext.empty");

const LocalFirstContext = createContext<any>(emptySymbol);

type Schema = any;

export const LocalFirstProvider = ({
  children,
  schema,
}: {
  children: React.ReactNode;
  schema: any;
}) => {
  return (
    <LocalFirstContext.Provider value={null}>
      {children}
    </LocalFirstContext.Provider>
  );
};

export const useLocalFirst = (selector: string) => {
  const store = useContext(LocalFirstContext);

  if (store == emptySymbol) {
    throw new Error("Missing LocalFirstProvider");
  }

  return {
    asd: selector,
  };
};
