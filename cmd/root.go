package cmd

import (
	"context"
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

var (
	configMapName string
	configMapNS   string
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "bootstrap-olm",
	Short: "Bootstrap OLM",
	Long: `A longer description that spans multiple lines and likely contains
examples and usage of using your application. For example:

Cobra is a CLI library for Go that empowers applications.
This application is a tool to generate the needed files
to quickly create a Cobra application.`,
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	err := rootCmd.Execute()
	if err != nil {
		os.Exit(1)
	}
}

func init() {
	cobra.OnInitialize(initConfig)

	// Here you will define your flags and configuration settings.
	// Cobra supports persistent flags, which, if defined here,
	// will be global for your application.

	rootCmd.PersistentFlags().StringVar(&configMapName, "configmap", "bootstrap-olm-config", "name of the ConfigMap containing configuration (default: bootstrap-olm-config)")
	rootCmd.PersistentFlags().StringVar(&configMapNS, "configmap-namespace", "olm", "namespace of the ConfigMap")
}

// initConfig reads in config file and ENV variables if set.
func initConfig() {
	// Set default values
	viper.SetDefault("olmGitHubRepository", "https://github.com/operator-framework/operator-lifecycle-manager")
	viper.SetDefault("version", "latest")
	viper.SetDefault("namespace", "olm")

	// Get in-cluster config
	config, err := rest.InClusterConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error getting in-cluster config: %v\n", err)
		os.Exit(1)
	}

	// Create the clientset
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error creating kubernetes client: %v\n", err)
		os.Exit(1)
	}

	// Get the ConfigMap
	cm, err := clientset.CoreV1().ConfigMaps(configMapNS).Get(context.Background(), configMapName, metav1.GetOptions{})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error getting ConfigMap: %v\n", err)
		os.Exit(1)
	}

	// Set the configuration from the ConfigMap data
	for key, value := range cm.Data {
		viper.Set(key, value)
	}

	fmt.Fprintf(os.Stderr, "Using ConfigMap: %s/%s\n", configMapNS, configMapName)
	viper.AutomaticEnv() // read in environment variables that match
}
