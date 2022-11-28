{ pkgs ? (import <nixpkgs> {})
}:
	pkgs.mkShell {
		buildInputs = with pkgs; [ nodejs-18_x nodePackages.npm nodePackages.typescript ];
	}
