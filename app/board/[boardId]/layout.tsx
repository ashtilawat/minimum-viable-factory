interface BoardLayoutProps {
  children: React.ReactNode;
  modal: React.ReactNode;
}

/**
 * Layout for the board route segment.
 *
 * Renders both the main board content (`children`) and the parallel `@modal`
 * slot so that the card detail overlay can be displayed on top of the board
 * without unmounting it.
 */
export default function BoardLayout({ children, modal }: BoardLayoutProps) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
