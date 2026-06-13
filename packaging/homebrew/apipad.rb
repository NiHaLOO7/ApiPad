cask "apipad" do
  version "0.1.0"

  on_arm do
    url "https://github.com/NiHaLOO7/ApiPad/releases/download/v#{version}/ApiPad_#{version}_aarch64.dmg"
    sha256 "24bf5921cfcda460cf719b336cc45be4403149f01b4eace2208549d52cb90f9a"
  end

  on_intel do
    url "https://github.com/NiHaLOO7/ApiPad/releases/download/v#{version}/ApiPad_#{version}_x64.dmg"
    sha256 "" # fill after intel build completes on GitHub Actions
  end

  name "ApiPad"
  desc "Lightweight native API testing desktop app"
  homepage "https://github.com/NiHaLOO7/ApiPad"

  app "ApiPad.app"

  zap trash: [
    "~/Library/Application Support/com.apipad.app",
    "~/Library/Logs/com.apipad.app",
  ]
end
