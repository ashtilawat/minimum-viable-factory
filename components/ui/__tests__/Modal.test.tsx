import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Modal from "@/components/ui/Modal";

describe("Modal", () => {
  it("renders nothing when isOpen is false", () => {
    render(
      <Modal isOpen={false} onClose={jest.fn()}>
        <p>Content</p>
      </Modal>
    );
    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });

  it("renders children when isOpen is true", () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()}>
        <p>Modal content</p>
      </Modal>
    );
    expect(screen.getByText("Modal content")).toBeInTheDocument();
  });

  it("renders a dialog with role='dialog' and aria-modal='true'", () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()}>
        <p>Content</p>
      </Modal>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("renders a title when the title prop is provided", () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()} title="Create Board">
        <p>Form</p>
      </Modal>
    );
    expect(screen.getByText("Create Board")).toBeInTheDocument();
  });

  it("renders a close button when title is provided", () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()} title="My Modal">
        Content
      </Modal>
    );
    expect(screen.getByRole("button", { name: "Close modal" })).toBeInTheDocument();
  });

  it("does not render a close button when title is omitted", () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()}>
        Content
      </Modal>
    );
    expect(screen.queryByRole("button", { name: "Close modal" })).not.toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="My Modal">
        Content
      </Modal>
    );
    await userEvent.click(screen.getByRole("button", { name: "Close modal" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the Escape key is pressed", () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen={true} onClose={onClose}>
        Content
      </Modal>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose on Escape when modal is closed", () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen={false} onClose={onClose}>
        Content
      </Modal>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("sets aria-labelledby on the dialog when title is provided", () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()} title="Labelled Modal">
        Content
      </Modal>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-labelledby", "modal-title");
  });

  it("does not set aria-labelledby on the dialog when title is omitted", () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()}>
        Content
      </Modal>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).not.toHaveAttribute("aria-labelledby");
  });

  it("locks body scroll when open", () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()}>
        Content
      </Modal>
    );
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("restores body scroll when unmounted", () => {
    const { unmount } = render(
      <Modal isOpen={true} onClose={jest.fn()}>
        Content
      </Modal>
    );
    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
