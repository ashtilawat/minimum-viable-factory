import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "@/components/ui/Input";

describe("Input", () => {
  it("renders an input element", () => {
    render(<Input />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders a label when the label prop is provided", () => {
    render(<Input id="email" label="Email Address" />);
    expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
  });

  it("does not render a label when the label prop is omitted", () => {
    render(<Input placeholder="Type here" />);
    expect(screen.queryByRole("label")).not.toBeInTheDocument();
  });

  it("associates label with input via id/htmlFor", () => {
    render(<Input id="username" label="Username" />);
    const input = screen.getByLabelText("Username");
    expect(input).toHaveAttribute("id", "username");
  });

  it("renders an error message when error prop is provided", () => {
    render(<Input error="This field is required" />);
    expect(screen.getByText("This field is required")).toBeInTheDocument();
  });

  it("does not render an error message when error prop is absent", () => {
    render(<Input placeholder="Fine" />);
    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
  });

  it("applies red border styles when error is provided", () => {
    render(<Input error="Invalid" />);
    const input = screen.getByRole("textbox");
    expect(input.className).toContain("border-red-500");
  });

  it("does not apply red border styles without an error", () => {
    render(<Input />);
    const input = screen.getByRole("textbox");
    expect(input.className).not.toContain("border-red-500");
  });

  it("accepts user input", async () => {
    render(<Input />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "hello");
    expect(input).toHaveValue("hello");
  });

  it("is disabled when disabled prop is passed", () => {
    render(<Input disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("forwards the placeholder attribute", () => {
    render(<Input placeholder="Search…" />);
    expect(screen.getByPlaceholderText("Search…")).toBeInTheDocument();
  });

  it("forwards extra HTML attributes (e.g. maxLength)", () => {
    render(<Input maxLength={20} />);
    expect(screen.getByRole("textbox")).toHaveAttribute("maxlength", "20");
  });

  it("merges custom className with base styles", () => {
    render(<Input className="w-full" />);
    expect(screen.getByRole("textbox").className).toContain("w-full");
  });

  it("forwards ref to the underlying input element", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe("INPUT");
  });
});
