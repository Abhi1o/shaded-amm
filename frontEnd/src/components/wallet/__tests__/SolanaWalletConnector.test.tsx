import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { SolanaWalletConnector } from "../SolanaWalletConnector";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletStore } from "../../../stores/walletStore";
import { useSolanaNetwork } from "../../../providers/SolanaWalletProvider";
import {
  MockPhantomAdapter,
  MockSolflareAdapter,
  mockSuccessfulConnection,
  mockFailedConnection,
  mockUserRejection,
  mockNetworkError,
  mockPublicKey,
} from "../../../test/mocks/walletMocks";

// Mock the hooks
vi.mock("@solana/wallet-adapter-react");
vi.mock("../../../stores/walletStore");
vi.mock("../../../providers/SolanaWalletProvider");
vi.mock("../../../config/wallets", () => ({
  WALLET_CONFIGS: {
    Phantom: {
      icon: "phantom-icon.svg",
      description: "Phantom wallet",
      popular: true,
      mobile: false,
    },
    Solflare: {
      icon: "solflare-icon.svg",
      description: "Solflare wallet",
      popular: true,
      mobile: false,
    },
  },
  getPopularWallets: vi.fn(() => ["Phantom", "Solflare"]),
  getMobileWallets: vi.fn(() => []),
  isMobileDevice: vi.fn(() => false),
}));

describe("SolanaWalletConnector", () => {
  const mockPhantomAdapter = new MockPhantomAdapter();
  const mockSolflareAdapter = new MockSolflareAdapter();

  const mockUseWallet = {
    wallets: [
      { adapter: mockPhantomAdapter, readyState: "Installed" },
      { adapter: mockSolflareAdapter, readyState: "Installed" },
    ],
    select: vi.fn(),
    connect: vi.fn(),
    connecting: false,
    connected: false,
    wallet: null,
    publicKey: null,
  };

  const mockUseWalletStore = {
    setWallet: vi.fn(),
  };

  const mockUseSolanaNetwork = {
    network: "devnet",
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConnect: vi.fn(),
    onError: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(useWallet).mockReturnValue(mockUseWallet as any);
    vi.mocked(useWalletStore).mockReturnValue(mockUseWalletStore as any);
    vi.mocked(useSolanaNetwork).mockReturnValue(mockUseSolanaNetwork as any);

    // Reset all mocks
    vi.clearAllMocks();
    mockPhantomAdapter.connect.mockClear();
    mockSolflareAdapter.connect.mockClear();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Wallet Connection Flow", () => {
    it("should display available wallets when modal is open", () => {
      render(<SolanaWalletConnector {...defaultProps} />);

      expect(screen.getByText("Connect Wallet")).toBeInTheDocument();
      expect(screen.getByText("Phantom")).toBeInTheDocument();
      expect(screen.getByText("Solflare")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Connect your Solana wallet to start trading on devnet"
        )
      ).toBeInTheDocument();
    });

    it("should not render when modal is closed", () => {
      render(<SolanaWalletConnector {...defaultProps} isOpen={false} />);

      expect(screen.queryByText("Connect Wallet")).not.toBeInTheDocument();
    });

    it("should successfully connect to Phantom wallet", async () => {
      const user = userEvent.setup();
      mockSuccessfulConnection(mockPhantomAdapter);

      // Mock successful connection flow
      mockUseWallet.connect.mockResolvedValue(undefined);
      mockUseWallet.connected = true;
      mockUseWallet.publicKey = mockPublicKey;
      mockUseWallet.wallet = { adapter: mockPhantomAdapter };

      render(<SolanaWalletConnector {...defaultProps} />);

      const phantomButton = screen.getByText("Phantom").closest("button");
      expect(phantomButton).toBeInTheDocument();

      await user.click(phantomButton!);

      await waitFor(() => {
        expect(mockUseWallet.select).toHaveBeenCalledWith("Phantom");
        expect(mockUseWallet.connect).toHaveBeenCalled();
      });
    });

    it("should successfully connect to Solflare wallet", async () => {
      const user = userEvent.setup();
      mockSuccessfulConnection(mockSolflareAdapter);

      mockUseWallet.connect.mockResolvedValue(undefined);
      mockUseWallet.connected = true;
      mockUseWallet.publicKey = mockPublicKey;
      mockUseWallet.wallet = { adapter: mockSolflareAdapter };

      render(<SolanaWalletConnector {...defaultProps} />);

      const solflareButton = screen.getByText("Solflare").closest("button");
      await user.click(solflareButton!);

      await waitFor(() => {
        expect(mockUseWallet.select).toHaveBeenCalledWith("Solflare");
        expect(mockUseWallet.connect).toHaveBeenCalled();
      });
    });

    it("should show loading state during connection", async () => {
      const user = userEvent.setup();
      mockUseWallet.connecting = true;

      render(<SolanaWalletConnector {...defaultProps} />);

      const phantomButton = screen.getByText("Phantom").closest("button");
      await user.click(phantomButton!);

      // Should show loading spinner
      expect(screen.getByRole("button", { name: /phantom/i })).toHaveClass(
        "opacity-50"
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle connection failure and display error message", async () => {
      const user = userEvent.setup();
      const connectionError = new Error("Connection failed");
      mockFailedConnection(mockPhantomAdapter, connectionError);
      mockUseWallet.connect.mockRejectedValue(connectionError);

      render(<SolanaWalletConnector {...defaultProps} />);

      const phantomButton = screen.getByText("Phantom").closest("button");
      await user.click(phantomButton!);

      await waitFor(() => {
        expect(screen.getByText("Connection Failed")).toBeInTheDocument();
        expect(screen.getByText("Connection failed")).toBeInTheDocument();
      });

      expect(defaultProps.onError).toHaveBeenCalledWith(connectionError);
    });

    it("should handle user rejection gracefully", async () => {
      const user = userEvent.setup();
      const rejectionError = new Error("User rejected the request");
      mockUserRejection(mockPhantomAdapter);
      mockUseWallet.connect.mockRejectedValue(rejectionError);

      render(<SolanaWalletConnector {...defaultProps} />);

      const phantomButton = screen.getByText("Phantom").closest("button");
      await user.click(phantomButton!);

      await waitFor(() => {
        expect(screen.getByText("Connection Failed")).toBeInTheDocument();
        expect(
          screen.getByText("User rejected the request")
        ).toBeInTheDocument();
      });
    });

    it("should handle network errors", async () => {
      const user = userEvent.setup();
      const networkError = new Error("Network connection failed");
      mockNetworkError(mockPhantomAdapter);
      mockUseWallet.connect.mockRejectedValue(networkError);

      render(<SolanaWalletConnector {...defaultProps} />);

      const phantomButton = screen.getByText("Phantom").closest("button");
      await user.click(phantomButton!);

      await waitFor(() => {
        expect(screen.getByText("Connection Failed")).toBeInTheDocument();
        expect(
          screen.getByText("Network connection failed")
        ).toBeInTheDocument();
      });
    });

    it("should clear error when modal is closed and reopened", async () => {
      const user = userEvent.setup();
      const connectionError = new Error("Connection failed");
      mockUseWallet.connect.mockRejectedValue(connectionError);

      const { rerender } = render(<SolanaWalletConnector {...defaultProps} />);

      const phantomButton = screen.getByText("Phantom").closest("button");
      await user.click(phantomButton!);

      await waitFor(() => {
        expect(screen.getByText("Connection Failed")).toBeInTheDocument();
      });

      // Close modal
      rerender(<SolanaWalletConnector {...defaultProps} isOpen={false} />);

      // Reopen modal
      rerender(<SolanaWalletConnector {...defaultProps} isOpen={true} />);

      expect(screen.queryByText("Connection Failed")).not.toBeInTheDocument();
    });
  });

  describe("State Persistence and Reconnection", () => {
    it("should update wallet store on successful connection", async () => {
      const user = userEvent.setup();
      mockSuccessfulConnection(mockPhantomAdapter);

      // Simulate successful connection
      mockUseWallet.connected = true;
      mockUseWallet.publicKey = mockPublicKey;
      mockUseWallet.wallet = { adapter: mockPhantomAdapter };
      mockUseWallet.connect.mockResolvedValue(undefined);

      const { rerender } = render(<SolanaWalletConnector {...defaultProps} />);

      const phantomButton = screen.getByText("Phantom").closest("button");
      await user.click(phantomButton!);

      // Trigger useEffect by re-rendering with connected state
      rerender(<SolanaWalletConnector {...defaultProps} />);

      await waitFor(() => {
        expect(mockUseWalletStore.setWallet).toHaveBeenCalledWith({
          publicKey: mockPublicKey,
          address: mockPublicKey.toString(),
          isConnected: true,
          isConnecting: false,
          cluster: "devnet",
          walletType: "phantom",
          walletName: "Phantom",
        });
      });

      expect(defaultProps.onConnect).toHaveBeenCalledWith("Phantom");
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should handle automatic reconnection attempts", async () => {
      // Simulate a previously connected wallet
      mockUseWallet.connected = true;
      mockUseWallet.publicKey = mockPublicKey;
      mockUseWallet.wallet = { adapter: mockPhantomAdapter };

      render(<SolanaWalletConnector {...defaultProps} />);

      await waitFor(() => {
        expect(mockUseWalletStore.setWallet).toHaveBeenCalledWith(
          expect.objectContaining({
            isConnected: true,
            walletName: "Phantom",
          })
        );
      });
    });

    it("should prevent connection when wallet is not installed", () => {
      // Mock uninstalled wallet
      const uninstalledWallets = [
        { adapter: mockPhantomAdapter, readyState: "NotDetected" },
      ];

      vi.mocked(useWallet).mockReturnValue({
        ...mockUseWallet,
        wallets: uninstalledWallets,
      } as any);

      render(<SolanaWalletConnector {...defaultProps} />);

      const phantomButton = screen.getByText("Phantom").closest("button");
      expect(phantomButton).toBeDisabled();
      expect(screen.getByText("Not installed")).toBeInTheDocument();
    });
  });

  describe("UI Interactions", () => {
    it("should close modal when close button is clicked", async () => {
      const user = userEvent.setup();
      render(<SolanaWalletConnector {...defaultProps} />);

      const closeButton = screen.getByRole("button", { name: "" }); // X button
      await user.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should display correct network information", () => {
      vi.mocked(useSolanaNetwork).mockReturnValue({
        network: "mainnet-beta",
      } as any);

      render(<SolanaWalletConnector {...defaultProps} />);

      expect(
        screen.getByText(
          "Connect your Solana wallet to start trading on mainnet-beta"
        )
      ).toBeInTheDocument();
    });

    it("should show popular wallets section", () => {
      render(<SolanaWalletConnector {...defaultProps} />);

      expect(screen.getByText("Popular Wallets")).toBeInTheDocument();
    });

    it("should disable buttons during connection", async () => {
      const user = userEvent.setup();

      render(<SolanaWalletConnector {...defaultProps} />);

      // Click a button to start connecting
      const phantomButton = screen.getByText("Phantom").closest("button");

      // Mock the connecting state after click
      mockUseWallet.connecting = true;
      mockUseWallet.connect.mockImplementation(async () => {
        // Simulate connection delay
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      await user.click(phantomButton!);

      // Check that buttons are disabled during connection
      expect(phantomButton).toHaveAttribute("disabled");
    });
  });
});
