// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.4.1"),
        .package(name: "CapacitorApp", path: "../../../frontend/node_modules/@capacitor/app"),
        .package(name: "CapacitorBackgroundRunner", path: "../../../frontend/node_modules/@capacitor/background-runner"),
        .package(name: "CapacitorDialog", path: "../../../frontend/node_modules/@capacitor/dialog"),
        .package(name: "CapacitorFilesystem", path: "../../../frontend/node_modules/@capacitor/filesystem"),
        .package(name: "CapacitorHaptics", path: "../../../frontend/node_modules/@capacitor/haptics"),
        .package(name: "CapacitorLocalNotifications", path: "../../../frontend/node_modules/@capacitor/local-notifications"),
        .package(name: "CapawesomeCapacitorFilePicker", path: "../../../frontend/node_modules/@capawesome/capacitor-file-picker"),
        .package(name: "CapgoCapacitorKeepAwake", path: "../../../frontend/node_modules/@capgo/capacitor-keep-awake"),
        .package(name: "CapgoCapacitorMediaSession", path: "../../../frontend/node_modules/@capgo/capacitor-media-session")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorBackgroundRunner", package: "CapacitorBackgroundRunner"),
                .product(name: "CapacitorDialog", package: "CapacitorDialog"),
                .product(name: "CapacitorFilesystem", package: "CapacitorFilesystem"),
                .product(name: "CapacitorHaptics", package: "CapacitorHaptics"),
                .product(name: "CapacitorLocalNotifications", package: "CapacitorLocalNotifications"),
                .product(name: "CapawesomeCapacitorFilePicker", package: "CapawesomeCapacitorFilePicker"),
                .product(name: "CapgoCapacitorKeepAwake", package: "CapgoCapacitorKeepAwake"),
                .product(name: "CapgoCapacitorMediaSession", package: "CapgoCapacitorMediaSession")
            ]
        )
    ]
)
