import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("renders children text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("shows a loading spinner and 'Loading…' when isLoading is true", () => {
    render(<Button isLoading>Save</Button>);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    // Original children should not be rendered
    expect(screen.queryByText("Save")).not.toBeInTheDocument();
  });

  it("is disabled when isLoading is true", () => {
    render(<Button isLoading>Save</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("is disabled when disabled prop is passed", () => {
    render(<Button disabled>Submit</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("calls onClick handler when clicked", async () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", async () => {
    const handleClick = jest.fn();
    render(
      <Button disabled onClick={handleClick}>
        Click
      </Button>
    );
    await userEvent.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("applies 'primary' variant classes by default", () => {
    render(<Button>Primary</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-blue-600");
  });

  it("applies 'danger' variant classes", () => {
    render(<Button variant="danger">Delete</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-red-600");
  });

  it("applies 'secondary' variant classes", () => {
    render(<Button variant="secondary">Cancel</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-white");
  });

  it("applies 'ghost' variant classes", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-transparent");
  });

  it("applies 'sm' size classes", () => {
    render(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button").className).toContain("px-3");
  });

  it("applies 'lg' size classes", () => {
    render(<Button size="lg">Large</Button>);
    expect(screen.getByRole("button").className).toContain("px-6");
  });

  it("merges custom className with base styles", () => {
    render(<Button className="my-custom-class">Custom</Button>);
    expect(screen.getByRole("button").className).toContain("my-custom-class");
  });

  it("forwards extra HTML attributes (e.g. type='submit')", () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("forwards ref to the underlying button element", () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref Button</Button>);
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe("BUTTON");
  });
});
