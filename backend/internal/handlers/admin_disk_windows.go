//go:build windows

package handlers

import (
	"os"
	"path/filepath"

	"golang.org/x/sys/windows"
)

func readDiskStatus(path string) serverDiskStatus {
	if path == "/" {
		cwd, err := os.Getwd()
		if err == nil {
			volume := filepath.VolumeName(cwd)
			if volume != "" {
				path = volume + `\`
			}
		}
	}
	pathPtr, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return serverDiskStatus{Path: path}
	}
	var freeBytesAvailableToCaller, totalBytes, totalFreeBytes uint64
	err = windows.GetDiskFreeSpaceEx(pathPtr, &freeBytesAvailableToCaller, &totalBytes, &totalFreeBytes)
	if err != nil {
		return serverDiskStatus{Path: path}
	}
	used := uint64(0)
	if totalBytes > totalFreeBytes {
		used = totalBytes - totalFreeBytes
	}
	return serverDiskStatus{
		Path:       path,
		TotalBytes: totalBytes,
		UsedBytes:  used,
		FreeBytes:  totalFreeBytes,
		Percent:    percent(used, totalBytes),
	}
}
