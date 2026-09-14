import { Outlet } from 'react-router-dom';

export function AppLayout(): JSX.Element {
  return (
    <>
      <header aria-label="Application header" />
      <aside aria-label="Application sidebar" />
      <Outlet />
    </>
  );
}
