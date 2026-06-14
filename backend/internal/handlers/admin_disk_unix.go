//go:build !windows

package handlers

import "syscall"

func readDiskStatus(path string) serverDiskStatus {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return serverDiskStatus{Path: path}
	}
	total := stat.Blocks * uint64(stat.Bsize)
	free := stat.Bavail * uint64(stat.Bsize)
	used := uint64(0)
	if total > free {
		used = total - free
	}
	return serverDiskStatus{
		Path:       path,
		TotalBytes: total,
		UsedBytes:  used,
		FreeBytes:  free,
		Percent:    percent(used, total),
	}
}
