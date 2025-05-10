package cmd

import (
	"fmt"

	"github.com/jacksonporter/bootstrap-olm/pkg/version"
	"github.com/spf13/cobra"
)

// versionCmd represents the version command
var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Gives the version of the bootstrap-olm CLI/library",
	Long:  `This command will print the version of the bootstrap-olm CLI/library. This is useful for debugging and ensuring that the correct version is being used.`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("bootstrap-olm " + version.Version)
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
}
