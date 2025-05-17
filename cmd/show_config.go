package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"gopkg.in/yaml.v3"
)

// showConfigCmd represents the show-config command
var showConfigCmd = &cobra.Command{
	Use:   "show-config",
	Short: "Show the current configuration",
	Long:  `Display the current configuration that has been loaded by the application.`,
	Run: func(cmd *cobra.Command, args []string) {
		// Get all settings from viper
		settings := viper.AllSettings()

		// Convert to YAML
		yamlData, err := yaml.Marshal(settings)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error marshaling config to YAML: %v\n", err)
			os.Exit(1)
		}

		// Print to stdout
		fmt.Print(string(yamlData))
	},
}

func init() {
	rootCmd.AddCommand(showConfigCmd)
}
