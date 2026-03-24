import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LabelBadge from "@/components/ui/LabelBadge";

describe("LabelBadge", () => {
  it("renders with the given background colour", () => {
    const { container } = render(<LabelBadge colour="#ff0000" />);
    // The badge is the outermost element (a span with inline style)
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveStyle({ backgroundColor: "#ff0000" });
  });

  it("renders text when the text prop is provided", () => {
    render(<LabelBadge colour="#00ff00" text="In Progress" />);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("does not render text content when text prop is omitted", () => {
    render(<LabelBadge colour="#0000ff" />);
    // No text node visible in the badge span apart from the optional remove button
    expect(screen.queryByText(/.+/)).not.toBeInTheDocument();
  });

  it("renders a remove button when onRemove is provided", () => {
    render(<LabelBadge colour="#123456" onRemove={jest.fn()} />);
    expect(
      screen.getByRole("button", { name: /remove label/i })
    ).toBeInTheDocument();
  });

  it("does not render a remove button when onRemove is not provided", () => {
    render(<LabelBadge colour="#123456" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("calls onRemove when the remove button is clicked", async () => {
    const onRemove = jest.fn();
    render(<LabelBadge colour="#abcdef" text="Bug" onRemove={onRemove} />);
    await userEvent.click(screen.getByRole("button", { name: /remove label/i }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("includes the label text in the remove button aria-label", () => {
    render(<LabelBadge colour="#aabbcc" text="Feature" onRemove={jest.fn()} />);
    expect(
      screen.getByRole("button", { name: 'Remove label "Feature"' })
    ).toBeInTheDocument();
  });

  it("uses generic aria-label when text is absent", () => {
    render(<LabelBadge colour="#112233" onRemove={jest.fn()} />);
    expect(
      screen.getByRole("button", { name: "Remove label" })
    ).toBeInTheDocument();
  });

  it("merges custom className prop", () => {
    const { container } = render(
      <LabelBadge colour="#ff0000" className="custom-badge" />
    );
    expect(container.firstChild).toHaveClass("custom-badge");
  });
});
